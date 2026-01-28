# from google import genai
# from openai import OpenAI
# from PIL import Image
# import os
# from dotenv import load_dotenv
# import json 
# from fastapi import FastAPI, HTTPException, Request
# from fastapi.responses import RedirectResponse
# from fastapi.middleware.cors import CORSMiddleware
# from typing import List
# from pydantic import BaseModel
# from datetime import datetime, date
# import io
# import shutil
# from getTransactions import getTransactions
# from getTransactions import getTransactionsInBatches, extract_completed_transactions
# from google_auth_oauthlib.flow import Flow
# from GoogleDrivePoll import get_flow, exchange_code_for_tokens
# filename = "new_transactions.json"
# activity_filename = "My Activity.html"
# # filename = "transactions_updated.json"
# # Load variables from .env into environment
# load_dotenv()
# latest_ressult = None
# api_key = os.getenv("OPENAI_API_KEY")

# class DateRange(BaseModel):
#     startDate: date
#     endDate: date

# class Transaction(BaseModel):
#     Classification: str
#     Amount: str
#     Receiver: str
#     Date: str

# class ReClassification(BaseModel):
#     original: Transaction
#     newClassification: str

# app = FastAPI()
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=['*'],
#     allow_methods=["*"],  # Allows GET, POST, OPTIONS, etc.
#     allow_headers=["*"],  # Allows all headers
# )


# def classify_transactions_gemini(api_key, activity_filename, json_file="new_transactions.json"):
#     try:
#         client = genai.Client(api_key=api_key)
#     except Exception as e:
#         print(f"Error initializing genai client: {e}")
#         return None

#     # Step 1: Load existing transactions if file exists
#     try:
#         with open(json_file, "r", encoding="utf-8") as f:
#             existing = json.load(f)
#     except (FileNotFoundError, json.JSONDecodeError):
#         existing = []

#     all_classified = []

#     # Step 2: Process new batches
#     for batch in extract_completed_transactions(activity_filename):
#         print("Sending batch:")

#         prompt = f"""You are a financial assistant that classifies transactions into various categories.

#         ===Response Guidelines
#         1. If there is no receiver, classify it as Personal Contact.
#         2. If the receiver is Blinkit, zepto, classify it as Quick Commerce.
#         3. Only If the receiver is Amazon or Flipkart, classify it as Ecommerce.
#         4. If the receiver is Spotify, Netflix, Hotstar, or Google Play, classify it as Subscriptions.
#         5. If the receiver has BMTC BUS or Bangalore Metro Rail Corporation Ltd, classify it as Public Transport.
#         6. If the receiver is Hungerbox, classify it as Office Lunch.
#         7. If the receiver has 'super market', 'supermarket', 'store', or 'mart' in its name, classify it strictly as Grocery.
#         8. If the receiver is a restaurant, has a food item in its name, or is a food chain, or has the name Zomato classify it as Eating Out.
#         9. If the receiver is just someone's name, classify it as Personal Transfer.
#         10. If the receiver has Fuel in its name, classify it as Fuel.
#         11. If the receiver doesn't fall into any of these categories, search up the name online and classify.
#         12. Respond in pure JSON only and strictly adhere to these guidelines.

#         ===Transactions
#         {batch}

#         === Response Format
#         {{
#             "Amount": "Amount associated with the transaction, do not include the currency symbol",
#             "Classification": "Whatever you classified it as",
#             "Receiver": "Receiver's name",
#             "Date": "Date and time of transaction in the format YYYY-MM-DD HH:MM:SS"
#         }}
#         """

#         try:
#             response = client.models.generate_content(
#                 model="gemini-2.5-flash-lite-preview-06-17",
#                 contents=prompt
#             )
#         except Exception as e:
#             print(f"Error generating content: {e}")
#             return None

#         try:
#             clean_content = (
#                 response.text.strip()
#                 .removeprefix("```json")
#                 .removesuffix("```")
#                 .strip()
#             )
#         except Exception as e:
#             print(f"Error cleaning response: {e}")
#             return None

#         try:
#             json_data = json.loads(clean_content)
#             if isinstance(json_data, dict):
#                 all_classified.append(json_data)
#             elif isinstance(json_data, list):
#                 all_classified.extend(json_data)
#         except json.JSONDecodeError as e:
#             print(f"Error: The content is not valid JSON. {e}")
#             print("Content attempted to write:")
#             print(clean_content)
#         except Exception as e:
#             print(f"An unexpected error occurred: {e}")
#             return clean_content

#     # Step 3: Append new transactions to existing and save
#     updated = existing + all_classified
#     with open(json_file, "w", encoding="utf-8") as f:
#         json.dump(updated, f, indent=2, ensure_ascii=False)

#     print(f"Appended {len(all_classified)} new transactions to '{json_file}'")
#     return all_classified

# def load_transactions_between(start_date: date, end_date: date):
#     with open(filename, "r") as f:
#         data = json.load(f)

#     filtered = []
#     for item in data:
#         tx_date = datetime.strptime(item["Date"], "%Y-%m-%d %H:%M:%S").date()
#         if start_date <= tx_date <= end_date:
#             filtered.append(item)

#     return filtered


# # API Endpoint
# @app.post("/daterange")
# def recieve_date_range(date_range : DateRange):
#     # return chatbot.classify_transactions(startDate, endDate)
#     print(date_range.startDate)
#     print(date_range.endDate)
#     results = load_transactions_between(date_range.startDate, date_range.endDate)
#     print(results)
#     return results


# @app.post("/classify")
# def classify_transactions():
#     classify_transactions_gemini(api_key, activity_filename)

# @app.post("/reclassify")
# def reclassify(Reclassification : ReClassification):
#     print(Reclassification.original)
#     print(Reclassification.newClassification)

#     # Load data
#     try:
#         with open(filename, "r") as f:
#             transactions: List[dict] = json.load(f)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to load transactions: {str(e)}")

#     # Find by Date
#     match_found = False
#     for tx in transactions:
#         if tx["Date"] == Reclassification.original.Date:
#             tx["Classification"] = Reclassification.newClassification
#             match_found = True
#             break

#     if not match_found:
#         raise HTTPException(status_code=404, detail="Transaction not found.")

#     # Save updated data
#     try:
#         with open(filename, "w") as f:
#             json.dump(transactions, f, ensure_ascii=False, indent=2)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to save updated transactions: {str(e)}")

#     return {"status": "updated", "data": transactions}


# @app.get("/login")
# def login():
#     flow = get_flow()
#     auth_url, _ = flow.authorization_url(prompt="consent")
#     return RedirectResponse(auth_url)

# @app.get("/oauth2callback")
# def oauth2callback(request: Request):
#     code = request.query_params.get("code")
#     if not code:
#         return {"error": "No code provided"}
    
#     token_dict = exchange_code_for_tokens(code)

#     # TODO: Save token_dict in DB keyed by user_id/email
#     # For now, just save to file
#     with open("user_token.json", "w") as f:
#         json.dump(token_dict, f)

#     return {"message": "Login successful! Tokens saved."}

import os, json
from fastapi import FastAPI, HTTPException, Request
from starlette.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, date, timedelta
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from dotenv import load_dotenv
from typing import List, Dict
from getTransactions import extract_completed_transactions
from google import genai
from typing import Optional

# === Config ===
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
    "https://mail.google.com/"  # Full Gmail access for IMAP
]
CLIENT_SECRETS_FILE = "credentials.json"
TOKENS_DIR = "tokens"
filename = "new_transactions.json"
activity_filename = "My Activity.html"

# === Load env ===
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
url = os.getenv("WEBSITE_URL")  # e.g., "http://localhost:8000"
# === FastAPI setup ===
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Models ===
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
    OriginalAmount: Optional[str] = None  # Store original amount before normalization

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
    Date: str  # Expected format: "YYYY-MM-DD HH:MM:SS"

# === OAuth Helpers ===
def get_flow():
    return Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri= url+"/oauth2callback"
    )

def save_tokens(user_id: str, token_dict: dict):
    os.makedirs(TOKENS_DIR, exist_ok=True)
    with open(os.path.join(TOKENS_DIR, f"{user_id}.json"), "w") as f:
        json.dump(token_dict, f)

@app.get("/login")
def login():
    flow = get_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",  # Request refresh token for long-term access
        prompt="consent",        # Force consent to always get a new refresh token
        include_granted_scopes="true"  # Include previously granted scopes
    )
    return RedirectResponse(auth_url)

@app.get("/oauth2callback")
def oauth2callback(request: Request):
    code = request.query_params.get("code")
    if not code:
        return {"error": "No code provided"}

    flow = get_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials

    token_dict = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes),
        "auth_timestamp": datetime.now().isoformat(),  # Track when user authenticated
    }

    # Get user email
    oauth2_service = build("oauth2", "v2", credentials=creds)
    user_info = oauth2_service.userinfo().get().execute()
    user_id = user_info["email"]

    save_tokens(user_id, token_dict)

    return {"message": f"Login successful for {user_id}", "user_id": user_id}

@app.get("/users")
def list_users():
    """List all users who have logged in (based on token files)."""
    if not os.path.exists(TOKENS_DIR):
        return []
    return [f.replace(".json", "") for f in os.listdir(TOKENS_DIR) if f.endswith(".json")]


# Token validity duration (Google testing apps expire after 7 days)
TOKEN_VALIDITY_HOURS = 168  # 7 days
REAUTH_WARNING_HOURS = 12   # Show warning when less than 12 hours remain


@app.get("/token-status/{user_id}")
def get_token_status(user_id: str):
    """
    Get the token status for a user, including time until expiry.
    Used by the frontend to show re-authentication warnings.
    """
    token_path = os.path.join(TOKENS_DIR, f"{user_id}.json")
    
    if not os.path.exists(token_path):
        return {
            "user_id": user_id,
            "authenticated": False,
            "auth_timestamp": None,
            "expires_at": None,
            "hours_remaining": 0,
            "needs_reauth": True,
            "message": "User not authenticated"
        }
    
    try:
        with open(token_path, "r") as f:
            token_dict = json.load(f)
        
        auth_timestamp_str = token_dict.get("auth_timestamp")
        
        if not auth_timestamp_str:
            # Legacy token without timestamp - assume it needs re-auth
            return {
                "user_id": user_id,
                "authenticated": True,
                "auth_timestamp": None,
                "expires_at": None,
                "hours_remaining": 0,
                "needs_reauth": True,
                "message": "Token missing timestamp, please re-authenticate"
            }
        
        auth_timestamp = datetime.fromisoformat(auth_timestamp_str)
        expires_at = auth_timestamp + timedelta(hours=TOKEN_VALIDITY_HOURS)
        now = datetime.now()
        
        time_remaining = expires_at - now
        hours_remaining = max(0, time_remaining.total_seconds() / 3600)
        
        needs_reauth = hours_remaining < REAUTH_WARNING_HOURS
        
        return {
            "user_id": user_id,
            "authenticated": True,
            "auth_timestamp": auth_timestamp_str,
            "expires_at": expires_at.isoformat(),
            "hours_remaining": round(hours_remaining, 2),
            "needs_reauth": needs_reauth,
            "message": "Token expiring soon, please re-authenticate" if needs_reauth else "Token valid"
        }
        
    except Exception as e:
        return {
            "user_id": user_id,
            "authenticated": False,
            "auth_timestamp": None,
            "expires_at": None,
            "hours_remaining": 0,
            "needs_reauth": True,
            "message": f"Error reading token: {str(e)}"
        }


@app.get("/token-status")
def get_all_token_status():
    """Get token status for all authenticated users."""
    users = list_users()
    if not users:
        return []
    return [get_token_status(user) for user in users]


# === Transaction classification ===

def classify_transactions_gemini(api_key, activity_filename, json_file="new_transactions.json"):
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Error initializing genai client: {e}")
        return None

    # Step 1: Load existing transactions if file exists
    try:
        with open(json_file, "r", encoding="utf-8") as f:
            existing = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        existing = []

    all_classified = []

    # Step 2: Process new batches
    for batch in extract_completed_transactions(activity_filename):
        print("Sending batch:")

        prompt = f"""You are a financial assistant that classifies transactions into various categories.

        ===Response Guidelines
        1. If there is no receiver, classify it as Personal Contact.
        2. If the receiver is Blinkit, zepto, classify it as Quick Commerce.
        3. Only If the receiver is Amazon or Flipkart, classify it as Ecommerce.
        4. If the receiver is Spotify, Netflix, Hotstar, or Google Play, classify it as Subscriptions.
        5. If the receiver has BMTC BUS or Bangalore Metro Rail Corporation Ltd, classify it as Public Transport.
        6. If the receiver is Hungerbox, classify it as Office Lunch.
        7. If the receiver has 'super market', 'supermarket', 'store', or 'mart' in its name, classify it strictly as Grocery.
        8. If the receiver is a restaurant, has a food item in its name, or is a food chain, or has the name Zomato classify it as Eating Out.
        9. If the receiver is just someone's name, classify it as Personal Transfer.
        10. If the receiver has Fuel in its name, classify it as Fuel.
        11. If the receiver doesn't fall into any of these categories, intelligently classify it by searching up the name online or classify based on the name intelligently.
        12. Respond in pure JSON only and strictly adhere to these guidelines.

        ===Transactions
        {batch}

        === Response Format
        {{
            "Amount": "Amount associated with the transaction, do not include the currency symbol",
            "Classification": "Whatever you classified it as",
            "Receiver": "Receiver's name",
            "Date": "Date and time of transaction in the format YYYY-MM-DD HH:MM:SS"
        }}
        """

        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=prompt
            )
        except Exception as e:
            print(f"Error generating content: {e}")
            return None

        try:
            clean_content = (
                response.text.strip()
                .removeprefix("```json")
                .removesuffix("```")
                .strip()
            )
        except Exception as e:
            print(f"Error cleaning response: {e}")
            return None

        try:
            json_data = json.loads(clean_content)
            if isinstance(json_data, dict):
                all_classified.append(json_data)
            elif isinstance(json_data, list):
                all_classified.extend(json_data)
        except json.JSONDecodeError as e:
            print(f"Error: The content is not valid JSON. {e}")
            print("Content attempted to write:")
            print(clean_content)
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            return clean_content

    # Step 3: Append new transactions to existing and save
    updated = existing + all_classified
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(updated, f, indent=2, ensure_ascii=False)

    print(f"Appended {len(all_classified)} new transactions to '{json_file}'")
    return all_classified

def load_transactions_between(start_date: date, end_date: date):
    with open(filename, "r") as f:
        data = json.load(f)

    filtered = []
    for item in data:
        tx_date = datetime.strptime(item["Date"], "%Y-%m-%d %H:%M:%S").date()
        if start_date <= tx_date <= end_date:
            filtered.append(item)

    return filtered

@app.post("/classify")
def classify_transactions():
    classify_transactions_gemini(api_key, activity_filename)

@app.post("/daterange")
def recieve_date_range(date_range: DateRange):
    with open(filename, "r") as f:
        data = json.load(f)
    filtered = [
        item for item in data
        if date_range.startDate <= datetime.strptime(item["Date"], "%Y-%m-%d %H:%M:%S").date() <= date_range.endDate
    ]
    return filtered

@app.post("/reclassify")
def reclassify(Reclassification: ReClassification):
    try:
        with open(filename, "r") as f:
            transactions: List[dict] = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load transactions: {str(e)}")

    match_found = False
    for tx in transactions:
        if tx["Date"] == Reclassification.original.Date:
            tx["Classification"] = Reclassification.newClassification
            match_found = True
            break

    if not match_found:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    try:
        with open(filename, "w") as f:
            json.dump(transactions, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save updated transactions: {str(e)}")

    return {"status": "updated", "data": transactions}

@app.post("/normalize")
def normalize(normalization: Normalization):
    try:
        with open(filename, "r") as f:
            transactions: List[dict] = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load transactions: {str(e)}")

    match_found = False
    for tx in transactions:
        if tx["Date"] == normalization.original.Date:
            print(f"Found transaction to normalize: Date={tx['Date']}, Current Amount={tx.get('Amount')}")
            
            # Calculate paid to me as sum of all payer amounts
            paid_to_me_total = 0.0
            if normalization.payers is not None and len(normalization.payers) > 0:
                for payer in normalization.payers:
                    try:
                        # Remove commas and parse amount
                        amount_str = payer.amount.replace(",", "").strip()
                        if amount_str:
                            paid_to_me_total += float(amount_str)
                    except (ValueError, AttributeError) as e:
                        print(f"Error parsing payer amount: {e}")
                        pass  # Skip invalid amounts
            
            print(f"Calculated PaidToMe total: {paid_to_me_total}")
            
            # Update normalization fields
            if paid_to_me_total > 0:
                # Determine the original amount (never changes once set)
                # Use OriginalAmount from request if available (calculated by frontend)
                # Otherwise, calculate from request Amount + existing PaidToMe
                try:
                    # Check if request has OriginalAmount (calculated by frontend)
                    if hasattr(normalization.original, 'OriginalAmount') and normalization.original.OriginalAmount:
                        true_original = float(normalization.original.OriginalAmount.replace(",", "").strip())
                        print(f"Using OriginalAmount from request: {true_original}")
                    else:
                        # Calculate from request Amount + existing PaidToMe
                        request_amount = float(normalization.original.Amount.replace(",", "").strip())
                        existing_paid_to_me = float(tx.get("PaidToMe", "0").replace(",", "").strip()) if tx.get("PaidToMe") else 0.0
                        # Request amount might be net, so add existing PaidToMe to get original
                        true_original = request_amount + existing_paid_to_me
                        print(f"Calculated OriginalAmount: Request={request_amount}, ExistingPaidToMe={existing_paid_to_me}, Original={true_original}")
                    
                    # Store or update OriginalAmount
                    if "OriginalAmount" not in tx or tx["OriginalAmount"] is None:
                        tx["OriginalAmount"] = str(true_original)
                        print(f"Stored OriginalAmount: {true_original}")
                    else:
                        existing_original = float(tx["OriginalAmount"].replace(",", "").strip())
                        # Update if different (to fix incorrect values)
                        if abs(existing_original - true_original) > 0.01:
                            print(f"Correcting OriginalAmount: Old={existing_original}, New={true_original}")
                            tx["OriginalAmount"] = str(true_original)
                        else:
                            print(f"Using existing OriginalAmount: {tx['OriginalAmount']}")
                except (ValueError, AttributeError) as e:
                    print(f"Error determining OriginalAmount: {e}")
                    import traceback
                    traceback.print_exc()
                    # Fallback: use current Amount as original if no PaidToMe exists
                    if "OriginalAmount" not in tx or tx["OriginalAmount"] is None:
                        current_amount = float(tx["Amount"].replace(",", "").strip())
                        existing_paid_to_me = float(tx.get("PaidToMe", "0").replace(",", "").strip()) if tx.get("PaidToMe") else 0.0
                        original_amount = current_amount + existing_paid_to_me
                        tx["OriginalAmount"] = str(original_amount)
                        print(f"Fallback: Stored OriginalAmount: {original_amount}")
                
                # Store normalization data
                tx["PaidToMe"] = str(paid_to_me_total)
                # Convert Payer objects to dictionaries
                tx["Payers"] = [{"name": payer.name, "amount": payer.amount} for payer in normalization.payers]
                
                # Calculate net amount (original - paid to me) and update Amount
                try:
                    original_amount_str = tx["OriginalAmount"].replace(",", "").strip()
                    original_amount = float(original_amount_str)
                    net_amount = original_amount - paid_to_me_total
                    
                    # CRITICAL: Update the Amount field to the net amount (this is what shows in charts)
                    old_amount = tx["Amount"]
                    # Format to 2 decimal places and remove trailing zeros, but keep as string
                    if net_amount == int(net_amount):
                        formatted_net = str(int(net_amount))
                    else:
                        formatted_net = f"{net_amount:.2f}".rstrip('0').rstrip('.')
                    
                    # Force update the Amount field
                    tx["Amount"] = formatted_net
                    
                    # Verify the update
                    if tx["Amount"] != formatted_net:
                        print(f"ERROR: Amount update failed! Expected {formatted_net}, got {tx['Amount']}")
                    else:
                        print(f"SUCCESS: Updated transaction Amount - Original={original_amount}, PaidToMe={paid_to_me_total}, Net={net_amount}, Old Amount={old_amount}, New Amount={tx['Amount']}")
                        
                except (ValueError, AttributeError) as e:
                    print(f"ERROR updating amount: {e}, OriginalAmount={tx.get('OriginalAmount')}, tx keys={list(tx.keys())}")
                    import traceback
                    traceback.print_exc()
                    pass  # Keep original amount if parsing fails
            else:
                # Remove normalization if no payers - restore original amount
                tx.pop("PaidToMe", None)
                tx.pop("Payers", None)
                if "OriginalAmount" in tx and tx["OriginalAmount"] is not None:
                    tx["Amount"] = tx["OriginalAmount"]
                    tx.pop("OriginalAmount", None)
                    print(f"Removed normalization, restored Amount to OriginalAmount: {tx['Amount']}")
            
            match_found = True
            break

    if not match_found:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    try:
        with open(filename, "w") as f:
            json.dump(transactions, f, ensure_ascii=False, indent=2)
        print(f"Successfully saved transactions to {filename}")
    except Exception as e:
        print(f"Error saving transactions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save updated transactions: {str(e)}")

    # Find and return the updated transaction for verification
    updated_tx = None
    for tx in transactions:
        if tx["Date"] == normalization.original.Date:
            updated_tx = tx
            break
    
    return {
        "status": "updated", 
        "data": transactions,
        "updated_transaction": updated_tx
    }

@app.post("/add-transaction")
def add_transaction(transaction: AddTransaction):
    """Add a new transaction manually."""
    try:
        with open(filename, "r") as f:
            transactions: List[dict] = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        transactions = []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load transactions: {str(e)}")

    # Check for duplicate (same date and amount)
    for tx in transactions:
        if tx["Date"] == transaction.Date and tx["Amount"] == transaction.Amount:
            raise HTTPException(status_code=400, detail="A transaction with this date and amount already exists.")

    # Create new transaction dict
    new_transaction = {
        "Amount": transaction.Amount,
        "Classification": transaction.Classification,
        "Receiver": transaction.Receiver,
        "Date": transaction.Date
    }

    transactions.append(new_transaction)

    try:
        with open(filename, "w") as f:
            json.dump(transactions, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save transaction: {str(e)}")

    return {"status": "created", "transaction": new_transaction}