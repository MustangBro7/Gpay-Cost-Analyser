from bs4 import BeautifulSoup
from datetime import datetime
import re
import json

def getTransactions():
    # --- 1. Read HTML from file ---
    with open("My Activity.html", "r", encoding="utf-8") as file:
        html_data = file.read()
    # --- 2. Parse with BeautifulSoup ---
    soup = BeautifulSoup(html_data, "html.parser")

    # --- 4. Extract and filter transactions ---
    transactions = []

    for div in soup.find_all("div", class_="mdl-grid"):
        text = div.get_text(separator=" ", strip=True)
        

        if "Paid ₹" in text and "using Bank Account" in text and "Completed" in text:
            amount_match = re.search(r"Paid ₹([\d,]+(?:\.\d+)?)", text)
            receiver_match = re.search(r"to (.+?) using", text)
            date_match = re.search(r"\d{1,2} \w{3,4} \d{4}, \d{2}:\d{2}:\d{2}", text)
            if amount_match and receiver_match and date_match:
                amount = amount_match.group(1)
                receiver = receiver_match.group(1)
                date_str = date_match.group(0)
                date_str = date_str.replace("Sept", "Sep")
                date_obj = datetime.strptime(date_str, "%d %b %Y, %H:%M:%S")


                transactions.append({
                    "amount": amount,
                    "receiver": receiver,
                    "date": date_obj.strftime("%Y-%m-%d %H:%M:%S")
                })

    # --- 5. Output filtered transactions ---
    for t in transactions:
        print(t)
    return transactions

# getTransactions()


def getTransactionsInBatches(batch_size=500):
    # --- 1. Read HTML from file ---
    with open("random.html", "r", encoding="utf-8") as file:
        html_data = file.read()

    # --- 2. Parse with BeautifulSoup ---
    soup = BeautifulSoup(html_data, "html.parser")

    # --- 3. Extract all matching transactions ---
    all_transactions = []

    for div in soup.find_all("div", class_="mdl-grid"):
        text = div.get_text(separator=" ", strip=True)

        if "Paid ₹" in text and "using Bank Account" in text and "Completed" in text:
            amount_match = re.search(r"Paid ₹([\d,]+(?:\.\d+)?)", text)
            receiver_match = re.search(r"to (.+?) using", text)
            date_match = re.search(r"\d{1,2} \w{3,4} \d{4}, \d{2}:\d{2}:\d{2}", text)
            print(receiver_match)
            # if not receiver_match:
            #     receiver_match = "Personal Contact" 
            if amount_match and date_match:
                amount = amount_match.group(1)
                receiver = receiver_match.group(1)
                date_str = date_match.group(0)
                date_str = date_str.replace("Sept", "Sep")
                date_obj = datetime.strptime(date_str, "%d %b %Y, %H:%M:%S")

                all_transactions.append({
                    "amount": amount,
                    "receiver": receiver,
                    "date": date_obj.strftime("%Y-%m-%d %H:%M:%S")
                })

    # --- 4. Yield in batches ---
    for i in range(0, len(all_transactions), batch_size):
        yield all_transactions[i:i + batch_size]

# for batch in getTransactionsInBatches():
#     print("Sending batch:")
#     for t in batch:
#         print(t)
    # print(batch)
    # send_to_llm(batch)  # Replace with your processing logic


# def extract_completed_transactions(filename, batch_size=500, json_file="gpay_transactions.json"):
#     try:
#         with open(json_file, "r", encoding="utf-8") as f:
#             existing = json.load(f)
#         if existing:
#             latest_date = max(datetime.strptime(tx["Date"], "%Y-%m-%d %H:%M:%S") for tx in existing)
#             print(f"Latest transaction date in JSON: {latest_date}")
#         else:
#             latest_date = None
#     except (FileNotFoundError, json.JSONDecodeError, KeyError):
#         latest_date = None
#     with open(filename, "r", encoding="utf-8") as file:
#         html = file.read()
#     soup = BeautifulSoup(html, "html.parser")
#     results = []
#     for outer in soup.find_all("div", class_="outer-cell mdl-cell mdl-cell--12-col mdl-shadow--2dp"):
#         main_div = outer.find("div", class_="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1")
#         caption_div = outer.find("div", class_="content-cell mdl-cell mdl-cell--12-col mdl-typography--caption")
#         if main_div and caption_div and "Completed" in caption_div.get_text():
#             main_text = main_div.get_text(separator=" ", strip=True)
#             if "Paid" in main_text or "Sent" in main_text:
#                 results.append(main_text)
#     print(results)
#     for i in range(0, len(results), batch_size):
#         yield results[i:i + batch_size]


def extract_completed_transactions(
    filename, batch_size=500, json_file="new_transactions.json"
):
    # Load latest transaction date from JSON
    try:
        with open(json_file, "r", encoding="utf-8") as f:
            existing = json.load(f)
        if existing:
            latest_date = max(
                datetime.strptime(tx["Date"], "%Y-%m-%d %H:%M:%S")
                for tx in existing
            )
            print(f"Latest transaction date in JSON: {latest_date}")
        else:
            latest_date = None
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        latest_date = None

    # Parse HTML
    with open(filename, "r", encoding="utf-8") as file:
        html = file.read()
    soup = BeautifulSoup(html, "html.parser")

    results = []
    seen = set()  # to avoid duplicates

    date_pattern = re.compile(
        r"\d{1,2} \w{3} \d{4}, \d{2}:\d{2}:\d{2} GMT[+-]\d{2}:\d{2}"
    )

    for outer in soup.find_all(
        "div", class_="outer-cell mdl-cell mdl-cell--12-col mdl-shadow--2dp"
    ):
        main_div = outer.find(
            "div",
            class_="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1",
        )
        caption_div = outer.find(
            "div",
            class_="content-cell mdl-cell mdl-cell--12-col mdl-typography--caption",
        )

        if main_div and caption_div and "Completed" in caption_div.get_text():
            main_text = main_div.get_text(separator=" ", strip=True)

            if "Paid" in main_text or "Sent" in main_text:
                match = date_pattern.search(main_text)
                if not match:
                    continue

                date_str = match.group(0)
                tx_text = main_text.replace(date_str, "").strip()

                try:
                    tx_date = datetime.strptime(
                        date_str, "%d %b %Y, %H:%M:%S GMT%z"
                    ).replace(tzinfo=None)

                    if latest_date is None or tx_date > latest_date:
                        key = (tx_text, tx_date.strftime("%Y-%m-%d %H:%M:%S"))
                        if key not in seen:  # ✅ prevent duplicates
                            seen.add(key)
                            results.append(
                                {
                                    "RawText": tx_text,
                                    "Date": tx_date.strftime("%Y-%m-%d %H:%M:%S"),
                                }
                            )
                except Exception as e:
                    print(f"Could not parse date from: {date_str} ({e})")
                    continue

    print(f"Found {len(results)} new transactions")

    for i in range(0, len(results), batch_size):
        yield results[i : i + batch_size]