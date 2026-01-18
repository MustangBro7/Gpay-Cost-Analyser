"""
Email Monitor Service for HDFC Bank Debit Alerts
Uses IMAP IDLE with XOAUTH2 for real-time email monitoring
"""

import os
import json
import re
import time
import base64
import email
from email.header import decode_header
from datetime import datetime
from typing import Optional, Dict, List
from dotenv import load_dotenv
from imapclient import IMAPClient
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google import genai

# === Config ===
load_dotenv()

TOKENS_DIR = "tokens"
TRANSACTIONS_FILE = "new_transactions.json"
HDFC_SENDER = "alerts@hdfcbank.net"
PROCESSED_IDS_FILE = "processed_email_ids.json"

# Gmail IMAP settings
IMAP_HOST = "imap.gmail.com"
IMAP_PORT = 993

api_key = os.getenv("OPENAI_API_KEY")


def load_tokens(user_id: str) -> Optional[dict]:
    """Load OAuth tokens for a user."""
    path = os.path.join(TOKENS_DIR, f"{user_id}.json")
    if not os.path.exists(path):
        print(f"No tokens found for {user_id}")
        return None
    with open(path, "r") as f:
        return json.load(f)


def save_tokens(user_id: str, token_dict: dict):
    """Save refreshed tokens back to file."""
    os.makedirs(TOKENS_DIR, exist_ok=True)
    with open(os.path.join(TOKENS_DIR, f"{user_id}.json"), "w") as f:
        json.dump(token_dict, f)


def get_valid_credentials(user_id: str) -> Optional[Credentials]:
    """Get valid OAuth credentials, refreshing if necessary."""
    token_dict = load_tokens(user_id)
    if not token_dict:
        return None
    
    creds = Credentials(
        token=token_dict.get("token"),
        refresh_token=token_dict.get("refresh_token"),
        token_uri=token_dict.get("token_uri"),
        client_id=token_dict.get("client_id"),
        client_secret=token_dict.get("client_secret"),
        scopes=token_dict.get("scopes")
    )
    
    # Refresh if expired
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            # Save refreshed tokens
            token_dict["token"] = creds.token
            save_tokens(user_id, token_dict)
            print(f"Refreshed tokens for {user_id}")
        except Exception as e:
            print(f"Failed to refresh tokens for {user_id}: {e}")
            return None
    
    return creds


def generate_xoauth2_string(email_address: str, access_token: str) -> str:
    """Generate XOAUTH2 authentication string for IMAP."""
    auth_string = f"user={email_address}\x01auth=Bearer {access_token}\x01\x01"
    return auth_string


def load_processed_ids() -> set:
    """Load set of already processed email Message-IDs."""
    try:
        with open(PROCESSED_IDS_FILE, "r") as f:
            return set(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()


def save_processed_id(message_id: str):
    """Save a processed email Message-ID."""
    processed = load_processed_ids()
    processed.add(message_id)
    # Keep only last 1000 IDs to prevent file from growing too large
    if len(processed) > 1000:
        processed = set(list(processed)[-1000:])
    with open(PROCESSED_IDS_FILE, "w") as f:
        json.dump(list(processed), f)


def get_email_body(msg) -> str:
    """Extract text body from email message."""
    body = ""
    
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            
            if content_type == "text/plain" and "attachment" not in content_disposition:
                try:
                    payload = part.get_payload(decode=True)
                    charset = part.get_content_charset() or 'utf-8'
                    body = payload.decode(charset, errors='ignore')
                    break
                except Exception as e:
                    print(f"Error decoding part: {e}")
            elif content_type == "text/html" and not body:
                try:
                    payload = part.get_payload(decode=True)
                    charset = part.get_content_charset() or 'utf-8'
                    body = payload.decode(charset, errors='ignore')
                except Exception as e:
                    print(f"Error decoding HTML part: {e}")
    else:
        try:
            payload = msg.get_payload(decode=True)
            charset = msg.get_content_charset() or 'utf-8'
            body = payload.decode(charset, errors='ignore')
        except Exception as e:
            print(f"Error decoding body: {e}")
    
    return body


def parse_hdfc_debit_email(body: str) -> Optional[Dict]:
    """
    Parse HDFC Bank debit alert email body to extract transaction details.
    
    Example HDFC format:
    "Dear Customer, Rs.166.00 has been debited from account 0230 to VPA 
    paytm-blinkit@ptybl Blinkit on 17-01-26. Your UPI transaction reference..."
    """
    result = {}
    
    # Clean HTML tags if present
    clean_body = re.sub(r'<[^>]+>', ' ', body)
    clean_body = re.sub(r'\s+', ' ', clean_body).strip()
    
    print(f"Parsing email body: {clean_body[:200]}...")
    
    # Pattern for amount - HDFC formats: "Rs.166.00 has been debited"
    amount_patterns = [
        r'Rs\.?\s*([\d,]+(?:\.\d{2})?)\s*has been debited',
        r'(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)\s*(?:has been|is|was)\s*debited',
        r'debited.*?(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)',
        r'(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)',
    ]
    
    for pattern in amount_patterns:
        match = re.search(pattern, clean_body, re.IGNORECASE)
        if match:
            amount = match.group(1).replace(",", "")
            result["Amount"] = amount
            print(f"Found amount: {amount}")
            break
    
    # Pattern for receiver/beneficiary - HDFC specific format:
    # "to VPA paytm-blinkit@ptybl Blinkit on 17-01-26"
    # We want to extract "Blinkit" (the name after VPA address)
    receiver_patterns = [
        # HDFC VPA format: "to VPA <vpa@address> <Name> on <date>"
        r'to VPA\s+[\w\-\.@]+\s+([A-Za-z][A-Za-z0-9\s&\-\.]+?)\s+on\s+\d',
        # Fallback: just get VPA address
        r'to VPA\s+([\w\-\.@]+)',
        # Generic patterns
        r'(?:to|at)\s+([A-Za-z][A-Za-z0-9\s&\-\.]{2,}?)\s+(?:on|via|using)\s+\d',
        r'(?:transferred to|paid to|payment to)\s+([A-Za-z0-9\s&\-\.]+)',
    ]
    
    for pattern in receiver_patterns:
        match = re.search(pattern, clean_body, re.IGNORECASE)
        if match:
            receiver = match.group(1).strip()
            # Clean up receiver name
            receiver = re.sub(r'\s+', ' ', receiver)
            if len(receiver) >= 2:
                result["Receiver"] = receiver
                print(f"Found receiver: {receiver}")
                break
    
    # Pattern for date/time - HDFC format: "on 17-01-26" (DD-MM-YY)
    date_patterns = [
        # DD-MM-YY format (most common in HDFC emails)
        r'on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
        r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*(?:at)?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)?',
        r'(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\s*(?:at)?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)?',
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, clean_body, re.IGNORECASE)
        if match:
            date_str = match.group(1)
            # Some patterns don't have time group
            try:
                time_str = match.group(2) if len(match.groups()) > 1 and match.group(2) else None
            except IndexError:
                time_str = None
            
            print(f"Found date string: {date_str}")
            
            # Try to parse various date formats
            date_formats = [
                "%d-%m-%y", "%d/%m/%y",  # DD-MM-YY first (HDFC format)
                "%d-%m-%Y", "%d/%m/%Y",
                "%d %b %Y", "%d %B %Y", "%d-%b-%Y", "%d-%b-%y",
            ]
            
            for fmt in date_formats:
                try:
                    parsed_date = datetime.strptime(date_str, fmt)
                    # Add time if available
                    if time_str:
                        time_str = time_str.strip()
                        time_formats = ["%H:%M:%S", "%H:%M", "%I:%M %p", "%I:%M:%S %p"]
                        for tfmt in time_formats:
                            try:
                                parsed_time = datetime.strptime(time_str, tfmt)
                                parsed_date = parsed_date.replace(
                                    hour=parsed_time.hour,
                                    minute=parsed_time.minute,
                                    second=parsed_time.second
                                )
                                break
                            except ValueError:
                                continue
                    
                    result["Date"] = parsed_date.strftime("%Y-%m-%d %H:%M:%S")
                    print(f"Parsed date: {result['Date']}")
                    break
                except ValueError:
                    continue
            
            if "Date" in result:
                break
    
    # If no date found, use current time
    if "Date" not in result:
        result["Date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"Using current time: {result['Date']}")
    
    # Only return if we found an amount (required field)
    if "Amount" in result:
        print(f"Final parsed result: {result}")
        return result
    
    print("No amount found in email body")
    return None


def extract_and_classify_transaction(body: str) -> Optional[Dict]:
    """
    Let Gemini extract ALL transaction details AND classify in one go.
    This handles any HDFC email format without manual parsing.
    """
    if not api_key:
        print("No API key found")
        return None
    
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Error initializing Gemini client: {e}")
        return None
    
    # Clean HTML tags if present
    clean_body = re.sub(r'<[^>]+>', ' ', body)
    clean_body = re.sub(r'\s+', ' ', clean_body).strip()
    
    print(f"Sending to Gemini for extraction: {clean_body[:200]}...")
    
    prompt = f"""You are a financial assistant. Extract transaction details from this HDFC Bank debit alert email and classify it.

===Email Body
{clean_body}

===Extraction Instructions
1. Extract the Amount (just the number, no currency symbol, no commas)
2. Extract the Receiver/Merchant name (who the money was paid to)
3. Extract the Date and Time of the transaction
4. Classify the transaction into a category

===Classification Guidelines
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
11. If the receiver doesn't fall into any of these categories, intelligently classify based on the merchant name.

=== Response Format (Respond ONLY with this JSON, nothing else)
{{
    "Amount": "extracted amount as number string without commas",
    "Classification": "category from the guidelines above",
    "Receiver": "merchant or receiver name",
    "Date": "YYYY-MM-DD HH:MM:SS format"
}}
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt
        )
        
        clean_content = (
            response.text.strip()
            .removeprefix("```json")
            .removesuffix("```")
            .strip()
        )
        
        print(f"Gemini response: {clean_content}")
        
        result = json.loads(clean_content)
        
        # Validate required fields
        if not result.get("Amount"):
            print("Gemini did not extract an amount")
            return None
            
        return result
        
    except json.JSONDecodeError as e:
        print(f"Error parsing Gemini response: {e}")
        return None
    except Exception as e:
        print(f"Error extracting/classifying transaction: {e}")
        return None


def save_transaction(transaction: Dict):
    """Append transaction to JSON file."""
    try:
        with open(TRANSACTIONS_FILE, "r", encoding="utf-8") as f:
            transactions = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        transactions = []
    
    # Check for duplicates by date and amount
    for existing in transactions:
        if (existing.get("Date") == transaction.get("Date") and 
            existing.get("Amount") == transaction.get("Amount")):
            print(f"Duplicate transaction found, skipping: {transaction}")
            return False
    
    transactions.append(transaction)
    
    with open(TRANSACTIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(transactions, f, indent=2, ensure_ascii=False)
    
    print(f"Saved transaction: {transaction}")
    return True


def process_email(msg, message_id: str) -> bool:
    """Process a single email and extract/classify transaction."""
    # Get sender
    from_header = msg.get("From", "")
    if HDFC_SENDER.lower() not in from_header.lower():
        return False
    
    # Get body
    body = get_email_body(msg)
    
    # Check for "debited" keyword
    if "debited" not in body.lower():
        print(f"Email from {HDFC_SENDER} but no 'debited' keyword found")
        return False
    
    print(f"Processing HDFC debit alert email (ID: {message_id})")
    
    # Let Gemini extract and classify everything from the email body
    transaction = extract_and_classify_transaction(body)
    if not transaction:
        print(f"Could not extract/classify transaction from email")
        return False
    
    print(f"Extracted transaction: {transaction}")
    
    # Save transaction
    if save_transaction(transaction):
        save_processed_id(message_id)
        return True
    
    return False


def connect_and_idle(user_id: str):
    """Connect to Gmail IMAP and monitor for new emails using IDLE."""
    creds = get_valid_credentials(user_id)
    if not creds:
        print(f"No valid credentials for {user_id}")
        return
    
    email_address = user_id  # user_id is the email address
    
    while True:
        try:
            print(f"Connecting to Gmail IMAP for {email_address}...")
            
            with IMAPClient(IMAP_HOST, port=IMAP_PORT, ssl=True) as client:
                # Authenticate using XOAUTH2
                auth_string = generate_xoauth2_string(email_address, creds.token)
                client.oauth2_login(email_address, creds.token)
                
                print(f"Successfully connected as {email_address}")
                
                # Select INBOX
                client.select_folder("INBOX")
                
                # Get already processed IDs
                processed_ids = load_processed_ids()
                
                # Search for unread emails from HDFC
                messages = client.search([
                    "UNSEEN",
                    "FROM", HDFC_SENDER
                ])
                
                # Process any existing unread HDFC emails
                if messages:
                    print(f"Found {len(messages)} unread HDFC emails")
                    for uid in messages:
                        try:
                            fetch_data = client.fetch([uid], ["RFC822", "ENVELOPE"])
                            for uid_key, data in fetch_data.items():
                                raw_email = data[b"RFC822"]
                                msg = email.message_from_bytes(raw_email)
                                message_id = msg.get("Message-ID", str(uid))
                                
                                if message_id not in processed_ids:
                                    if process_email(msg, message_id):
                                        # Mark as read
                                        client.set_flags([uid], [b"\\Seen"])
                        except Exception as e:
                            print(f"Error processing email {uid}: {e}")
                
                # Start IDLE mode for real-time monitoring
                print("Starting IDLE mode for real-time email monitoring...")
                
                while True:
                    # Start IDLE
                    client.idle()
                    
                    try:
                        # Wait for new mail (timeout after 29 minutes to refresh)
                        responses = client.idle_check(timeout=29*60)
                        
                        # End IDLE to process
                        client.idle_done()
                        
                        if responses:
                            print(f"IDLE responses: {responses}")
                            
                            # Check for new HDFC emails
                            messages = client.search([
                                "UNSEEN",
                                "FROM", HDFC_SENDER
                            ])
                            
                            if messages:
                                print(f"Found {len(messages)} new HDFC emails")
                                processed_ids = load_processed_ids()
                                
                                for uid in messages:
                                    try:
                                        fetch_data = client.fetch([uid], ["RFC822"])
                                        for uid_key, data in fetch_data.items():
                                            raw_email = data[b"RFC822"]
                                            msg = email.message_from_bytes(raw_email)
                                            message_id = msg.get("Message-ID", str(uid))
                                            
                                            if message_id not in processed_ids:
                                                if process_email(msg, message_id):
                                                    client.set_flags([uid], [b"\\Seen"])
                                    except Exception as e:
                                        print(f"Error processing email {uid}: {e}")
                        
                        # Refresh credentials if needed
                        if creds.expired:
                            creds = get_valid_credentials(user_id)
                            if not creds:
                                print("Failed to refresh credentials, reconnecting...")
                                break
                                
                    except KeyboardInterrupt:
                        print("Shutting down email monitor...")
                        client.idle_done()
                        return
                        
        except Exception as e:
            print(f"Connection error: {e}")
            print("Reconnecting in 30 seconds...")
            time.sleep(30)
            
            # Refresh credentials before reconnecting
            creds = get_valid_credentials(user_id)
            if not creds:
                print(f"Failed to get valid credentials for {user_id}")
                return


def main():
    """Main entry point for email monitor."""
    print("Starting Email Monitor Service...")
    
    if not os.path.exists(TOKENS_DIR):
        print("No users logged in yet. Run /login first.")
        return
    
    users = [f.replace(".json", "") for f in os.listdir(TOKENS_DIR) if f.endswith(".json")]
    
    if not users:
        print("No users found. Run /login first.")
        return
    
    # For simplicity, monitor first user
    # In production, you might want to use threading/multiprocessing for multiple users
    user = users[0]
    print(f"Monitoring emails for user: {user}")
    
    connect_and_idle(user)


if __name__ == "__main__":
    main()
