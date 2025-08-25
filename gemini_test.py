# from google import genai
# from PIL import Image

# client = genai.Client(api_key="AIzaSyCnEMwIVXawkK5oEXZin7v9zoQg-SxvbnE")

# image = Image.open("/Users/abhinavmohan/personal_projects/gpay_cost_analyser/WhatsApp Image 2025-07-03 at 20.35.39.jpeg")
# prompt = """You are a financial assistant that classifies transactions into various categories.
# Your task is to extract transaction data from an image, omitting any transactions where the amount is in green color or has a '+' sign before it. Then, you will classify these extracted transactions into various categories based on the provided guidelines.

# ===Image Data Extraction and Filtering Guidelines===
# 1. Identify all transactions from the image.
# 2. For each transaction, extract the 'Amount', 'Reciever', and 'Date'.
# 3. **Crucially, omit any transaction if its 'Amount' is displayed in green color or is prefixed with a '+' sign.**

# ===Transaction Classification Guidelines===
# 1. If the receiver is "Blinkit" or "zepto", classify it as "Quick Commerce".
# 2. Only if the receiver is "Amazon" or "Flipkart", classify it as "Ecommerce".
# 3. If the receiver is "Spotify", "Netflix", "Hotstar", or "Google Play", classify it as "Subscriptions".
# 4. If the receiver has "BMTC BUS" or "Bangalore Metro Rail Corporation Ltd", classify it as "Public Transport".
# 5. If the receiver is "Hungerbox", classify it as "Office Lunch".
# 6. If the receiver has 'super market', 'supermarket', 'store', or 'mart' in its name, classify it strictly as "Grocery".
# 7. If the receiver is a restaurant, has a food item in its name, or is a food chain, or has the name "Zomato", classify it as "Eating Out".
# 8. If the receiver is just someone's name, classify it as "Personal Transfer".
# 9. If the receiver has "Fuel" in its name, classify it as "Fuel".
# 10. If the receiver doesn't fall into any of these categories, search up the name online and classify.

# ===Response Format===
# Respond in pure JSON only. The output should be an array of JSON objects, with each object having the following format:


# {
#   "Amount": "value",
#   "Reciever": "value",
#   "Date": "value",
#   "Category": "value"
# }"""
# response = client.models.generate_content(
#     model="gemini-2.0-flash",
#     contents=[image, prompt]
# )
# print(response.text)

# clean_content = (
#     response.text.strip()
#     .removeprefix("```json")
#     .removesuffix("```")
#     .strip()
#   )
# print(clean_content)

from google import genai
from openai import OpenAI
from PIL import Image
import os
from dotenv import load_dotenv
import json 
from fastapi import FastAPI, HTTPException,File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from pydantic import BaseModel
from datetime import datetime, date
import io
import shutil
from getTransactions import getTransactions
from getTransactions import getTransactionsInBatches, extract_completed_transactions
filename = "new_transactions.json"
activity_filename = "My Activity.html"
# filename = "transactions_updated.json"
# Load variables from .env into environment
load_dotenv()
latest_ressult = None
api_key = os.getenv("OPENAI_API_KEY")

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

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=["*"],  # Allows GET, POST, OPTIONS, etc.
    allow_headers=["*"],  # Allows all headers
)

# def classify_transactions_gemini(api_key, activity_filename):
#     try:
#         client = genai.Client(
#             api_key=api_key
#         )   
        

#     except Exception as e:
#         print(f"Error initializing genai client: {e}")
#         return None

#     all_classified = []
#     for batch in extract_completed_transactions(activity_filename):
#       print("Sending batch:")
#       # for t in batch:
#       #     print(t)
#     # transactions = getTransactions()
#       prompt = f"""You are a financial assistant that classifies transactions into various categories.

#       ===Response Guidelines
#       1. If there is no receiver, classify it as Personal Contact.
#       2. If the receiver is Blinkit, zepto, classify it as Quick Commerce.
#       3. Only If the receiver is Amazon or Flipkart, classify it as Ecommerce.
#       4. If the receiver is Spotify, Netflix, Hotstar, or Google Play, classify it as Subscriptions.
#       5. If the receiver has BMTC BUS or Bangalore Metro Rail Corporation Ltd, classify it as Public Transport.
#       6. If the receiver is Hungerbox, classify it as Office Lunch.
#       7. If the receiver has 'super market', 'supermarket', 'store', or 'mart' in its name, classify it strictly as Grocery.
#       8. If the receiver is a restaurant, has a food item in its name, or is a food chain, or has the name Zomato classify it as Eating Out.
#       9. If the receiver is just someone's name, classify it as Personal Transfer.
#       10. If the receiver has Fuel in its name, classify it as Fuel.
#       11. If the receiver doesn't fall into any of these categories, search up the name online and classify.
#       12. Respond in pure JSON only and strictly adhere to these guidelines.


#       ===Transactions
#       {batch}

#       === Response Format
#       {{
#           "Amount": "Amount associated with the transaction, do not include the currency symbol",
#           "Classification": "Whatever you classified it as",
#           "Receiver": "Receiver's name",
#           "Date": "Date and time of transaction in the format YYYY-MM-DD HH:MM:SS",
#       }}

#       """

#       print(prompt)
#       try:
#         response = client.models.generate_content(
#             model="gemini-2.5-flash-lite-preview-06-17",
#             contents=prompt
#         )

#       except Exception as e:
#           print(f"Error generating content: {e}")
#           return None

#       try:
#           clean_content = (
#               response.text.strip()
#               .removeprefix("```json")
#               .removesuffix("```")
#               .strip()
#           )
#       except Exception as e:
#           print(f"Error cleaning response: {e}")
#           return None
#       try:
#         # Optional: Validate if the content is valid JSON before writing
#         # If it's not valid JSON, json.loads will raise an error
#         json_data = json.loads(clean_content)
#         if isinstance(json_data, dict):
#                 all_classified.append(json_data)
#         elif isinstance(json_data, list):
#             all_classified.extend(json_data)
#       except json.JSONDecodeError as e:
#         print(f"Error: The content is not valid JSON. {e}")
#         print("Content attempted to write:")
#         print(clean_content)
#       except Exception as e:
#         print(f"An unexpected error occurred: {e}")
#         return clean_content
#     with open(filename, "w", encoding="utf-8") as f:
#         json.dump(all_classified, f, indent=2, ensure_ascii=False)
#     print(f"Successfully wrote all classified transactions to '{filename}'")
#     return all_classified

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


# API Endpoint
@app.post("/daterange")
def recieve_date_range(date_range : DateRange):
    # return chatbot.classify_transactions(startDate, endDate)
    print(date_range.startDate)
    print(date_range.endDate)
    results = load_transactions_between(date_range.startDate, date_range.endDate)
    print(results)
    return results


@app.post("/classify")
def classify_transactions():
    classify_transactions_gemini(api_key, activity_filename)

@app.post("/reclassify")
def reclassify(Reclassification : ReClassification):
    print(Reclassification.original)
    print(Reclassification.newClassification)

    # Load data
    try:
        with open(filename, "r") as f:
            transactions: List[dict] = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load transactions: {str(e)}")

    # Find by Date
    match_found = False
    for tx in transactions:
        if tx["Date"] == Reclassification.original.Date:
            tx["Classification"] = Reclassification.newClassification
            match_found = True
            break

    if not match_found:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    # Save updated data
    try:
        with open(filename, "w") as f:
            json.dump(transactions, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save updated transactions: {str(e)}")

    return {"status": "updated", "data": transactions}