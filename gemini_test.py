import json
import os
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from jwt import PyJWKClient
from pydantic import BaseModel
from starlette.responses import RedirectResponse

from getTransactions import extract_completed_transactions
from storage_layer import TransactionBlobStore, build_user_store

# === Config ===
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
    "https://mail.google.com/",
]
CLIENT_SECRETS_FILE = "credentials.json"
activity_filename = "My Activity.html"
TOKEN_VALIDITY_HOURS = 168
REAUTH_WARNING_HOURS = 12

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
api_base_url = os.getenv("WEBSITE_URL", "http://localhost:8000")
worker_shared_secret = os.getenv("WORKER_SHARED_SECRET")
clerk_issuer = os.getenv("CLERK_ISSUER")
clerk_jwks_url = os.getenv("CLERK_JWKS_URL")

user_store = build_user_store()
blob_store = TransactionBlobStore()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class DateRange(BaseModel):
    startDate: date
    endDate: date


class Transaction(BaseModel):
    Classification: str
    Amount: str
    Receiver: Optional[str] = None
    Date: str
    PaidToMe: Optional[str] = None
    Payers: Optional[List[Dict[str, str]]] = None
    OriginalAmount: Optional[str] = None


class ReClassification(BaseModel):
    original: Transaction
    newClassification: str


class Payer(BaseModel):
    name: str
    amount: str


class Normalization(BaseModel):
    original: Transaction
    paidToMe: Optional[str] = None
    payers: Optional[List[Payer]] = None


class AddTransaction(BaseModel):
    Amount: str
    Classification: str
    Receiver: str
    Date: str


class AppendTransactionRequest(BaseModel):
    user_email: str
    transaction: Dict[str, Any]


def _build_clerk_jwks_client() -> PyJWKClient:
    jwks_url = clerk_jwks_url
    if not jwks_url:
        if not clerk_issuer:
            raise HTTPException(status_code=500, detail="Clerk issuer/JWKS configuration missing.")
        jwks_url = f"{clerk_issuer.rstrip('/')}/.well-known/jwks.json"
    return PyJWKClient(jwks_url)


def verify_clerk_token(token: str) -> Dict[str, Any]:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    try:
        jwks_client = _build_clerk_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token).key
        options = {"verify_aud": False}
        kwargs: Dict[str, Any] = {"algorithms": ["RS256"], "options": options}
        if clerk_issuer:
            kwargs["issuer"] = clerk_issuer
        payload = jwt.decode(token, signing_key, **kwargs)
        return payload
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Clerk token: {exc}")


def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authorization header with Bearer token required.")
    token = authorization.split(" ", 1)[1]
    payload = verify_clerk_token(token)
    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="Clerk token missing subject.")
    user = user_store.get_user_by_clerk_id(clerk_user_id)
    if not user:
        emails = payload.get("email")
        if isinstance(emails, str):
            email = emails
        elif isinstance(payload.get("email_addresses"), list) and payload["email_addresses"]:
            email = payload["email_addresses"][0]
        else:
            email = f"{clerk_user_id}@placeholder.local"
        user = user_store.upsert_user(clerk_user_id=clerk_user_id, email=email)
    return user


def get_optional_current_user(authorization: Optional[str] = Header(default=None)) -> Optional[Dict[str, Any]]:
    if not authorization:
        return None
    return get_current_user(authorization)


def ensure_worker(x_worker_secret: Optional[str] = Header(default=None)) -> None:
    if not worker_shared_secret:
        raise HTTPException(status_code=500, detail="WORKER_SHARED_SECRET is not configured.")
    if x_worker_secret != worker_shared_secret:
        raise HTTPException(status_code=403, detail="Invalid worker secret.")


def get_flow(state: Optional[str] = None) -> Flow:
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=f"{api_base_url}/oauth2callback",
    )
    if state:
        flow.oauth2session.state = state
    return flow


def get_user_transactions(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    return blob_store.get_transactions(user["transactions_s3_key"])


def save_user_transactions(user: Dict[str, Any], transactions: List[Dict[str, Any]]) -> None:
    blob_store.put_transactions(user["transactions_s3_key"], transactions)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/login")
def login(
    clerk_user_id: Optional[str] = Query(default=None),
    email: Optional[str] = Query(default=None),
):
    state_payload = {"clerk_user_id": clerk_user_id, "email": email}
    state = json.dumps(state_payload)
    flow = get_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
        state=state,
    )
    return RedirectResponse(auth_url)


@app.get("/oauth2callback")
def oauth2callback(request: Request):
    code = request.query_params.get("code")
    raw_state = request.query_params.get("state")
    if not code:
        raise HTTPException(status_code=400, detail="No code provided")

    flow = get_flow(state=raw_state)
    flow.fetch_token(code=code)
    creds = flow.credentials

    token_dict = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes),
        "auth_timestamp": datetime.now().isoformat(),
    }

    oauth2_service = build("oauth2", "v2", credentials=creds)
    user_info = oauth2_service.userinfo().get().execute()
    google_email = user_info["email"]

    state_payload: Dict[str, Any] = {}
    if raw_state:
        try:
            state_payload = json.loads(raw_state)
        except json.JSONDecodeError:
            state_payload = {}

    clerk_user_id = state_payload.get("clerk_user_id") or google_email
    linked_email = state_payload.get("email") or google_email
    user_store.save_google_tokens(clerk_user_id=clerk_user_id, email=linked_email, token_dict=token_dict)

    return {"message": f"Google connected for {linked_email}", "google_email": google_email}


@app.get("/token-status")
def token_status(current_user: Dict[str, Any] = Depends(get_current_user)):
    token_dict = user_store.get_google_tokens_by_clerk_id(current_user["clerk_user_id"])
    if not token_dict:
        return {
            "user_id": current_user["clerk_user_id"],
            "authenticated": False,
            "auth_timestamp": None,
            "expires_at": None,
            "hours_remaining": 0,
            "needs_reauth": True,
            "message": "Google not connected",
        }

    auth_timestamp = token_dict.get("auth_timestamp")
    if not auth_timestamp:
        return {
            "user_id": current_user["clerk_user_id"],
            "authenticated": True,
            "auth_timestamp": None,
            "expires_at": None,
            "hours_remaining": 0,
            "needs_reauth": True,
            "message": "Token timestamp missing",
        }

    auth_dt = datetime.fromisoformat(auth_timestamp)
    expires_at = auth_dt + timedelta(hours=TOKEN_VALIDITY_HOURS)
    hours_remaining = max(0.0, (expires_at - datetime.now()).total_seconds() / 3600)
    needs_reauth = hours_remaining < REAUTH_WARNING_HOURS
    return {
        "user_id": current_user["clerk_user_id"],
        "authenticated": True,
        "auth_timestamp": auth_timestamp,
        "expires_at": expires_at.isoformat(),
        "hours_remaining": round(hours_remaining, 2),
        "needs_reauth": needs_reauth,
        "message": "Token expiring soon" if needs_reauth else "Token valid",
    }


def classify_transactions_gemini(
    existing_transactions: List[Dict[str, Any]],
    source_activity_filename: str,
) -> List[Dict[str, Any]]:
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured.")
    client = genai.Client(api_key=api_key)
    all_classified: List[Dict[str, Any]] = []

    for batch in extract_completed_transactions(
        source_activity_filename,
        existing_transactions=existing_transactions,
    ):
        prompt = f"""You are a financial assistant that classifies transactions into categories.
Return strict JSON only.

===Transactions
{batch}

=== Response Format
{{
    "Amount": "number string",
    "Classification": "category",
    "Receiver": "receiver name",
    "Date": "YYYY-MM-DD HH:MM:SS"
}}
"""
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
        )
        clean_content = (
            response.text.strip().removeprefix("```json").removesuffix("```").strip()
        )
        payload = json.loads(clean_content)
        if isinstance(payload, dict):
            all_classified.append(payload)
        elif isinstance(payload, list):
            all_classified.extend(payload)
    return all_classified


@app.post("/classify")
def classify_transactions(
    user_email: Optional[str] = Query(default=None),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user),
    x_worker_secret: Optional[str] = Header(default=None),
):
    if user_email:
        ensure_worker(x_worker_secret)
        user = user_store.get_user_by_email(user_email)
        if not user:
            raise HTTPException(status_code=404, detail=f"User not found for {user_email}")
    else:
        if not current_user:
            raise HTTPException(status_code=401, detail="User not authenticated.")
        user = current_user

    transactions = get_user_transactions(user)
    classified = classify_transactions_gemini(
        existing_transactions=transactions,
        source_activity_filename=activity_filename,
    )
    transactions.extend(classified)
    save_user_transactions(user, transactions)
    return {"status": "ok", "classified_count": len(classified)}


@app.post("/daterange")
def receive_date_range(date_range: DateRange, current_user: Dict[str, Any] = Depends(get_current_user)):
    data = get_user_transactions(current_user)
    filtered = [
        item
        for item in data
        if date_range.startDate
        <= datetime.strptime(item["Date"], "%Y-%m-%d %H:%M:%S").date()
        <= date_range.endDate
    ]
    return filtered


@app.post("/reclassify")
def reclassify(payload: ReClassification, current_user: Dict[str, Any] = Depends(get_current_user)):
    transactions = get_user_transactions(current_user)
    match_found = False
    for tx in transactions:
        if tx["Date"] == payload.original.Date:
            tx["Classification"] = payload.newClassification
            match_found = True
            break
    if not match_found:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    save_user_transactions(current_user, transactions)
    return {"status": "updated", "data": transactions}


@app.post("/normalize")
def normalize(payload: Normalization, current_user: Dict[str, Any] = Depends(get_current_user)):
    transactions = get_user_transactions(current_user)
    match_found = False
    for tx in transactions:
        if tx["Date"] != payload.original.Date:
            continue

        paid_to_me_total = 0.0
        if payload.payers:
            for payer in payload.payers:
                try:
                    paid_to_me_total += float(payer.amount.replace(",", "").strip())
                except (ValueError, AttributeError):
                    continue

        if paid_to_me_total > 0:
            if payload.original.OriginalAmount:
                true_original = float(payload.original.OriginalAmount.replace(",", "").strip())
            else:
                request_amount = float(payload.original.Amount.replace(",", "").strip())
                existing_paid = float(tx.get("PaidToMe", "0").replace(",", "").strip()) if tx.get("PaidToMe") else 0.0
                true_original = request_amount + existing_paid

            tx["OriginalAmount"] = str(true_original)
            tx["PaidToMe"] = str(paid_to_me_total)
            tx["Payers"] = [{"name": payer.name, "amount": payer.amount} for payer in payload.payers or []]

            net_amount = true_original - paid_to_me_total
            tx["Amount"] = str(int(net_amount)) if net_amount == int(net_amount) else f"{net_amount:.2f}".rstrip("0").rstrip(".")
        else:
            tx.pop("PaidToMe", None)
            tx.pop("Payers", None)
            if tx.get("OriginalAmount") is not None:
                tx["Amount"] = tx["OriginalAmount"]
                tx.pop("OriginalAmount", None)

        match_found = True
        break

    if not match_found:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    save_user_transactions(current_user, transactions)
    updated_tx = next((tx for tx in transactions if tx["Date"] == payload.original.Date), None)
    return {"status": "updated", "data": transactions, "updated_transaction": updated_tx}


@app.post("/add-transaction")
def add_transaction(payload: AddTransaction, current_user: Dict[str, Any] = Depends(get_current_user)):
    transactions = get_user_transactions(current_user)
    for tx in transactions:
        if tx["Date"] == payload.Date and tx["Amount"] == payload.Amount:
            raise HTTPException(status_code=400, detail="A transaction with this date and amount already exists.")

    new_tx = {
        "Amount": payload.Amount,
        "Classification": payload.Classification,
        "Receiver": payload.Receiver,
        "Date": payload.Date,
    }
    transactions.append(new_tx)
    save_user_transactions(current_user, transactions)
    return {"status": "created", "transaction": new_tx}


@app.get("/internal/users")
def internal_list_users(x_worker_secret: Optional[str] = Header(default=None)):
    ensure_worker(x_worker_secret)
    users = user_store.list_worker_users()
    return [
        {
            "clerk_user_id": user["clerk_user_id"],
            "email": user["email"],
            "transactions_s3_key": user["transactions_s3_key"],
        }
        for user in users
    ]


@app.get("/internal/google-token/{user_email}")
def internal_get_google_token(user_email: str, x_worker_secret: Optional[str] = Header(default=None)):
    ensure_worker(x_worker_secret)
    token_dict = user_store.get_google_tokens_by_email(user_email)
    if not token_dict:
        raise HTTPException(status_code=404, detail="Google tokens not found for user.")
    return token_dict


@app.post("/internal/google-token/{user_email}")
def internal_put_google_token(
    user_email: str,
    token_payload: Dict[str, Any],
    x_worker_secret: Optional[str] = Header(default=None),
):
    ensure_worker(x_worker_secret)
    user = user_store.get_user_by_email(user_email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user_store.save_google_tokens(
        clerk_user_id=user["clerk_user_id"],
        email=user["email"],
        token_dict=token_payload,
    )
    return {"status": "updated"}


@app.post("/internal/transactions/append")
def internal_append_transaction(
    payload: AppendTransactionRequest,
    x_worker_secret: Optional[str] = Header(default=None),
):
    ensure_worker(x_worker_secret)
    user = user_store.get_user_by_email(payload.user_email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    transactions = get_user_transactions(user)
    for existing in transactions:
        if existing.get("Date") == payload.transaction.get("Date") and existing.get("Amount") == payload.transaction.get("Amount"):
            return {"status": "duplicate_skipped"}
    transactions.append(payload.transaction)
    save_user_transactions(user, transactions)
    return {"status": "appended"}
