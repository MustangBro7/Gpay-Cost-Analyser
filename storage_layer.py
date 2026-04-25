import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Generator, List, Optional

import boto3
from botocore.exceptions import ClientError


class StorageConfigError(RuntimeError):
    pass


class UserStore:
    """
    Turso-compatible metadata store.

    This implementation uses sqlite syntax so it works with local sqlite and
    Turso/libsql SQL dialect.
    """

    def __init__(self, database_path: str):
        self.database_path = database_path
        self._init_db()

    @contextmanager
    def connection(self) -> Generator[sqlite3.Connection, None, None]:
        conn = sqlite3.connect(self.database_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        os.makedirs(os.path.dirname(self.database_path) or ".", exist_ok=True)
        with self.connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    clerk_user_id TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    transactions_s3_key TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS google_tokens (
                    user_id INTEGER PRIMARY KEY,
                    token_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
                """
            )

    def _default_s3_key(self, clerk_user_id: str) -> str:
        return f"transactions/{clerk_user_id}.json"

    def upsert_user(self, clerk_user_id: str, email: str) -> Dict[str, Any]:
        now = datetime.utcnow().isoformat()
        with self.connection() as conn:
            row = conn.execute(
                "SELECT id, transactions_s3_key FROM users WHERE clerk_user_id = ?",
                (clerk_user_id,),
            ).fetchone()
            if row:
                conn.execute(
                    """
                    UPDATE users
                    SET email = ?, updated_at = ?
                    WHERE clerk_user_id = ?
                    """,
                    (email, now, clerk_user_id),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO users (clerk_user_id, email, transactions_s3_key, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (clerk_user_id, email, self._default_s3_key(clerk_user_id), now, now),
                )
        return self.get_user_by_clerk_id(clerk_user_id)

    def get_user_by_clerk_id(self, clerk_user_id: str) -> Optional[Dict[str, Any]]:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE clerk_user_id = ?",
                (clerk_user_id,),
            ).fetchone()
        return dict(row) if row else None

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE email = ?",
                (email,),
            ).fetchone()
        return dict(row) if row else None

    def save_google_tokens(self, clerk_user_id: str, email: str, token_dict: Dict[str, Any]) -> Dict[str, Any]:
        user = self.upsert_user(clerk_user_id=clerk_user_id, email=email)
        now = datetime.utcnow().isoformat()
        with self.connection() as conn:
            conn.execute(
                """
                INSERT INTO google_tokens (user_id, token_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    token_json = excluded.token_json,
                    updated_at = excluded.updated_at
                """,
                (user["id"], json.dumps(token_dict), now),
            )
        return user

    def get_google_tokens_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        with self.connection() as conn:
            row = conn.execute(
                """
                SELECT gt.token_json
                FROM google_tokens gt
                JOIN users u ON u.id = gt.user_id
                WHERE u.email = ?
                """,
                (email,),
            ).fetchone()
        if not row:
            return None
        return json.loads(row["token_json"])

    def get_google_tokens_by_clerk_id(self, clerk_user_id: str) -> Optional[Dict[str, Any]]:
        with self.connection() as conn:
            row = conn.execute(
                """
                SELECT gt.token_json
                FROM google_tokens gt
                JOIN users u ON u.id = gt.user_id
                WHERE u.clerk_user_id = ?
                """,
                (clerk_user_id,),
            ).fetchone()
        if not row:
            return None
        return json.loads(row["token_json"])

    def list_worker_users(self) -> List[Dict[str, Any]]:
        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT u.clerk_user_id, u.email, u.transactions_s3_key, gt.token_json
                FROM users u
                JOIN google_tokens gt ON gt.user_id = u.id
                ORDER BY u.created_at ASC
                """
            ).fetchall()
        users: List[Dict[str, Any]] = []
        for row in rows:
            users.append(
                {
                    "clerk_user_id": row["clerk_user_id"],
                    "email": row["email"],
                    "transactions_s3_key": row["transactions_s3_key"],
                    "google_tokens": json.loads(row["token_json"]),
                }
            )
        return users


class TransactionBlobStore:
    def __init__(self) -> None:
        self.bucket = os.getenv("TRANSACTIONS_BUCKET")
        self.region = os.getenv("AWS_REGION", "auto")
        self.endpoint_url = os.getenv("S3_ENDPOINT_URL")
        self.access_key = os.getenv("S3_ACCESS_KEY_ID")
        self.secret_key = os.getenv("S3_SECRET_ACCESS_KEY")
        self.local_fallback_dir = os.getenv("LOCAL_TRANSACTIONS_DIR", "data/transactions")

        self._s3_client = None
        if self.bucket and self.access_key and self.secret_key:
            self._s3_client = boto3.client(
                "s3",
                region_name=self.region,
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
            )

    def _local_path(self, object_key: str) -> str:
        safe_key = object_key.replace("/", "__")
        os.makedirs(self.local_fallback_dir, exist_ok=True)
        return os.path.join(self.local_fallback_dir, safe_key)

    def get_transactions(self, object_key: str) -> List[Dict[str, Any]]:
        if self._s3_client:
            try:
                response = self._s3_client.get_object(Bucket=self.bucket, Key=object_key)
                raw_data = response["Body"].read().decode("utf-8")
                return json.loads(raw_data)
            except ClientError as exc:
                code = exc.response.get("Error", {}).get("Code")
                if code in {"NoSuchKey", "404"}:
                    return []
                raise
        local_path = self._local_path(object_key)
        try:
            with open(local_path, "r", encoding="utf-8") as file:
                return json.load(file)
        except (FileNotFoundError, json.JSONDecodeError):
            return []

    def put_transactions(self, object_key: str, transactions: List[Dict[str, Any]]) -> None:
        serialized = json.dumps(transactions, ensure_ascii=False, indent=2)
        if self._s3_client:
            self._s3_client.put_object(
                Bucket=self.bucket,
                Key=object_key,
                Body=serialized.encode("utf-8"),
                ContentType="application/json",
            )
            return
        local_path = self._local_path(object_key)
        with open(local_path, "w", encoding="utf-8") as file:
            file.write(serialized)


def build_user_store() -> UserStore:
    db_path = os.getenv("TURSO_DATABASE_PATH", "data/turso.db")
    if db_path.startswith("libsql://"):
        raise StorageConfigError(
            "TURSO_DATABASE_PATH currently expects a sqlite file path. "
            "Use a local Turso/libsql replica path in this deployment."
        )
    return UserStore(db_path)

