# import os, json
# import time
# import zipfile
# import requests
# from googleapiclient.discovery import build
# from googleapiclient.http import MediaIoBaseDownload
# from googleapiclient.errors import HttpError
# from google.oauth2.credentials import Credentials
# from google_auth_oauthlib.flow import InstalledAppFlow
# from google_auth_oauthlib.flow import Flow

# SCOPES = ['https://www.googleapis.com/auth/drive']
# CLIENT_SECRETS_FILE = "credentials.json"

# # Change this to your API endpoint
# ENDPOINT_URL = "http://localhost:8000/classify"

# def get_flow():
#     return Flow.from_client_secrets_file(
#         CLIENT_SECRETS_FILE,
#         scopes=SCOPES,
#         redirect_uri="http://localhost:8000/oauth2callback"
#     )

# def exchange_code_for_tokens(code):
#     flow = get_flow()
#     flow.fetch_token(code=code)
#     creds = flow.credentials
#     return {
#         "access_token": creds.token,-
#         "refresh_token": creds.refresh_token,
#         "token_uri": creds.token_uri,
#         "client_id": creds.client_id,
#         "client_secret": creds.client_secret,
#         "scopes": creds.scopes
#     }

# def build_service_from_tokens(token_dict):
#     creds = Credentials.from_authorized_user_info(token_dict, SCOPES)
#     return build("drive", "v3", credentials=creds)

# def load_tokens(user_id: str):
#     path = os.path.join("tokens", f"{user_id}.json")
#     if not os.path.exists(path):
#         print(f"No tokens found for {user_id}. Please log in via /login first.")
#         return None
#     with open(path, "r") as f:
#         return json.load(f)

# def get_user_service(user_id: str):
#     token_dict = load_tokens(user_id)
#     if not token_dict:
#         return None
#     creds = Credentials.from_authorized_user_info(token_dict, SCOPES)
#     return build("drive", "v3", credentials=creds)

# def get_credentials():
#     if os.path.exists('token.json'):
#         creds = Credentials.from_authorized_user_file('token.json', SCOPES)
#     else:
#         flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
#         creds = flow.run_local_server(port=0)
#         with open('token.json', 'w') as token:
#             token.write(creds.to_json())
#     return creds

# def find_folder_id(service, folder_name):
#     results = service.files().list(
#         q=f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}'",
#         spaces='drive',
#         fields="files(id, name)"
#     ).execute()
#     folders = results.get('files', [])
#     if not folders:
#         print(f"No folder named '{folder_name}' found.")
#         return None
#     folder_id = folders[0]['id']
#     print(f"Found folder '{folder_name}' with ID: {folder_id}")
#     return folder_id

# def list_takeout_files_in_folder(service, folder_id):
#     results = service.files().list(
#         q=f"'{folder_id}' in parents and name contains 'takeout'",
#         spaces='drive',
#         fields="files(id, name, mimeType, createdTime, size)"
#     ).execute()
#     files = results.get('files', [])
#     for f in files:
#         print(f"Found: {f['name']} (MIME: {f['mimeType']})")
#     return [f for f in files if f['name'].endswith('.zip')]

# def download_file(service, file_id, filename):
#     request = service.files().get_media(fileId=file_id)
#     with open(filename, 'wb') as f:
#         downloader = MediaIoBaseDownload(f, request)
#         done = False
#         while not done:
#             status, done = downloader.next_chunk()
#             if status:
#                 print(f"Download {int(status.progress() * 100)}%.")
#     print(f"Downloaded {filename}")

# def delete_file_from_drive(service, file_id, filename):
#     try:
#         service.files().delete(fileId=file_id).execute()
#         print(f"Deleted {filename} from Google Drive.")
#     except HttpError as error:
#         print(f"An error occurred while deleting {filename}: {error}")

# def get_most_recent_file(files):
#     if not files:
#         return None
#     files_sorted = sorted(files, key=lambda x: x['createdTime'], reverse=True)
#     return files_sorted[0]

# def keep_only_one_takeout_file():
#     local_files = [f for f in os.listdir('.') if f.startswith('takeout-') and f.endswith('.zip')]
#     if not local_files:
#         return None
#     files_with_1 = [f for f in local_files if '-1-' in f]
#     if files_with_1:
#         to_keep = files_with_1[0]
#     else:
#         to_keep = max(local_files, key=lambda f: os.path.getsize(f))
#     for f in local_files:
#         if f != to_keep:
#             try:
#                 os.remove(f)
#                 print(f"Deleted local file: {f}")
#             except Exception as e:
#                 print(f"Could not delete {f}: {e}")
#     print(f"Kept local file: {to_keep}")
#     return os.path.abspath(to_keep)

# def extract_my_activity(zip_path, target_filename="My Activity.html"):
#     """Extracts 'My Activity.html' from the given zip file and replaces existing one."""
#     try:
#         with zipfile.ZipFile(zip_path, 'r') as zip_ref:
#             for member in zip_ref.namelist():
#                 if member.endswith(target_filename):
#                     print(f"Found {target_filename} inside {zip_path} at {member}")
#                     extracted_path = os.path.join(os.getcwd(), target_filename)
#                     with zip_ref.open(member) as source, open(extracted_path, "wb") as target:
#                         target.write(source.read())
#                     print(f"Extracted {target_filename} to {extracted_path}")
                    
#                     # 🔥 Call endpoint after extraction
#                     try:
#                         response = requests.post(ENDPOINT_URL)
#                         print(f"Called endpoint {ENDPOINT_URL}, status: {response.status_code}")
#                     except Exception as e:
#                         print(f"Failed to call endpoint: {e}")
                    
#                     return extracted_path
#         print(f"{target_filename} not found in {zip_path}")
#         return None
#     except Exception as e:
#         print(f"Error extracting {target_filename}: {e}")
#         return None

# def poll_and_download(folder_name="takeout", user_id="default"):
#     service = get_user_service(user_id)
#     folder_id = find_folder_id(service, folder_name)
#     if not folder_id:
#         print("Exiting: Folder not found.")
#         return None

#     files = list_takeout_files_in_folder(service, folder_id)
#     most_recent = get_most_recent_file(files)
#     if most_recent:
#         filename = most_recent['name']
#         if not os.path.exists(filename):
#             print(f"Downloading most recent file: {filename}")
#             download_file(service, most_recent['id'], filename)
#             delete_file_from_drive(service, most_recent['id'], filename)
#             kept_path = keep_only_one_takeout_file()
#             print(f"Final kept file path: {kept_path}")
#             extract_my_activity(kept_path)
#         else:
#             print(f"File {filename} already exists. Skipping download.")
#             kept_path = keep_only_one_takeout_file()
#             print(f"Final kept file path: {kept_path}")
#             extract_my_activity(kept_path)
#     else:
#         print("No takeout zip files found on startup.")
#         kept_path = keep_only_one_takeout_file()
#         print(f"Final kept file path: {kept_path}")
#         if kept_path:
#             extract_my_activity(kept_path)

#     while True:
#         files = list_takeout_files_in_folder(service, folder_id)
#         new_files = [file for file in files if not os.path.exists(file['name'])]
#         if new_files:
#             new_files_sorted = sorted(new_files, key=lambda x: x['createdTime'])
#             for file in new_files_sorted:
#                 filename = file['name']
#                 if not os.path.exists(filename):
#                     print(f"Downloading new file: {filename}")
#                     download_file(service, file['id'], filename)
#                     delete_file_from_drive(service, file['id'], filename)
#                     kept_path = keep_only_one_takeout_file()
#                     print(f"Final kept file path: {kept_path}")
#                     extract_my_activity(kept_path)
#                 else:
#                     print(f"File {filename} already exists. Skipping download.")
#                     kept_path = keep_only_one_takeout_file()
#                     print(f"Final kept file path: {kept_path}")
#                     extract_my_activity(kept_path)
#         else:
#             print("No new takeout files found. Waiting...")
#         time.sleep(300)  # Poll every 5 minutes

# if __name__ == "__main__":
#     poll_and_download("takeout")

import os, json, time, zipfile, requests
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from googleapiclient.errors import HttpError
from google.oauth2.credentials import Credentials

SCOPES = ['https://www.googleapis.com/auth/drive']
TOKENS_DIR = "tokens"
ENDPOINT_URL = "http://api:8000/classify"

def load_tokens(user_id: str):
    path = os.path.join(TOKENS_DIR, f"{user_id}.json")
    if not os.path.exists(path):
        print(f"No tokens found for {user_id}. Please log in via /login first.")
        return None
    with open(path, "r") as f:
        return json.load(f)

def get_user_service(user_id: str):
    token_dict = load_tokens(user_id)
    if not token_dict:
        return None
    creds = Credentials.from_authorized_user_info(token_dict, SCOPES)
    return build("drive", "v3", credentials=creds)

def find_folder_id(service, folder_name):
    results = service.files().list(
        q=f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}'",
        spaces='drive',
        fields="files(id, name)"
    ).execute()
    folders = results.get('files', [])
    if not folders:
        print(f"No folder named '{folder_name}' found.")
        return None
    return folders[0]['id']

def list_takeout_files_in_folder(service, folder_id):
    results = service.files().list(
        q=f"'{folder_id}' in parents and name contains 'takeout'",
        spaces='drive',
        fields="files(id, name, mimeType, createdTime, size)"
    ).execute()
    files = results.get('files', [])
    for f in files:
        print(f"Found: {f['name']} (MIME: {f['mimeType']})")
    return [f for f in files if f['name'].endswith('.zip')]

def download_file(service, file_id, filename):
    request = service.files().get_media(fileId=file_id)
    with open(filename, 'wb') as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status:
                print(f"Download {int(status.progress() * 100)}%.")
    print(f"Downloaded {filename}")

def delete_file_from_drive(service, file_id, filename):
    try:
        service.files().delete(fileId=file_id).execute()
        print(f"Deleted {filename} from Google Drive.")
    except HttpError as error:
        print(f"An error occurred while deleting {filename}: {error}")

def get_most_recent_file(files):
    if not files:
        return None
    return sorted(files, key=lambda x: x['createdTime'], reverse=True)[0]

def keep_only_one_takeout_file():
    local_files = [f for f in os.listdir('.') if f.startswith('takeout-') and f.endswith('.zip')]
    if not local_files:
        return None
    files_with_1 = [f for f in local_files if '-1-' in f]
    to_keep = files_with_1[0] if files_with_1 else max(local_files, key=lambda f: os.path.getsize(f))
    for f in local_files:
        if f != to_keep:
            try:
                os.remove(f)
                print(f"Deleted local file: {f}")
            except Exception as e:
                print(f"Could not delete {f}: {e}")
    print(f"Kept local file: {to_keep}")
    return os.path.abspath(to_keep)

def extract_my_activity(zip_path, target_filename="My Activity.html"):
    """Extracts 'My Activity.html' from the given zip file, replaces existing one, and deletes the zip."""
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for member in zip_ref.namelist():
                if member.endswith(target_filename):
                    extracted_path = os.path.join(os.getcwd(), target_filename)

                    # Overwrite existing My Activity.html
                    with zip_ref.open(member) as source, open(extracted_path, "wb") as target:
                        target.write(source.read())

                    print(f"Extracted {target_filename} to {extracted_path}")

                    # 🔥 Call backend classify endpoint
                    try:
                        response = requests.post(ENDPOINT_URL)
                        print(f"Called endpoint {ENDPOINT_URL}, status: {response.status_code}")
                    except Exception as e:
                        print(f"Failed to call endpoint: {e}")

                    # ✅ Delete the zip after extraction
                    try:
                        os.remove(zip_path)
                        print(f"Deleted zip file: {zip_path}")
                    except Exception as e:
                        print(f"Could not delete zip {zip_path}: {e}")

                    return extracted_path

        print(f"{target_filename} not found in {zip_path}")
        return None
    except Exception as e:
        print(f"Error extracting {target_filename}: {e}")
        return None

def poll_and_download(user_id: str, folder_name="takeout"):
    service = get_user_service(user_id)
    if not service:
        print(f"Skipping {user_id}, no valid tokens.")
        return

    folder_id = find_folder_id(service, folder_name)
    if not folder_id:
        print(f"No folder '{folder_name}' found for {user_id}")
        return

    while True:
        files = list_takeout_files_in_folder(service, folder_id)
        if files:
            most_recent = get_most_recent_file(files)
            filename = most_recent['name']
            if not os.path.exists(filename):
                print(f"[{user_id}] Downloading {filename}")
                download_file(service, most_recent['id'], filename)
                delete_file_from_drive(service, most_recent['id'], filename)
                kept_path = keep_only_one_takeout_file()
                extract_my_activity(kept_path)
            else:
                print(f"[{user_id}] {filename} already exists, skipping.")
        else:
            print(f"[{user_id}] No takeout files found.")
        time.sleep(300)  # poll every 5 minutes

if __name__ == "__main__":
    if not os.path.exists(TOKENS_DIR):
        print("No users logged in yet. Run /login first.")
    else:
        users = [f.replace(".json", "") for f in os.listdir(TOKENS_DIR) if f.endswith(".json")]
        if not users:
            print("No users found. Run /login first.")
        else:
            for user in users:
                print(f"Starting poller for {user}")
                poll_and_download(user)