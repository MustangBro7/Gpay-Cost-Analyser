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
from datetime import datetime, date
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from dotenv import load_dotenv
from typing import List
from getTransactions import extract_completed_transactions
from google import genai

# === Config ===
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid"
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
    Receiver: str
    Date: str

class ReClassification(BaseModel):
    original: Transaction
    newClassification: str

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
    auth_url, _ = flow.authorization_url(prompt="consent")
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
        11. If the receiver doesn't fall into any of these categories, search up the name online and classify.
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
                model="gemini-2.5-flash-lite-preview-06-17",
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