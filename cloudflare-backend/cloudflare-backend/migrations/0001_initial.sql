CREATE TABLE IF NOT EXISTS users (
  clerk_user_id TEXT PRIMARY KEY,
  clerk_email TEXT NOT NULL,
  google_email TEXT UNIQUE,
  google_auth_status TEXT NOT NULL CHECK (google_auth_status IN ('disconnected', 'active', 'reauth_required', 'error')),
  google_connected_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  clerk_user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry_at TEXT,
  scopes_json TEXT NOT NULL,
  auth_timestamp TEXT NOT NULL,
  last_refresh_at TEXT,
  last_refresh_error TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gmail_watch_state (
  clerk_user_id TEXT PRIMARY KEY,
  google_email TEXT NOT NULL UNIQUE,
  topic_name TEXT NOT NULL,
  last_history_id TEXT,
  watch_expiration_at TEXT,
  last_notification_at TEXT,
  last_sync_at TEXT,
  last_renewal_at TEXT,
  last_error TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'error', 'pending')),
  FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gmail_processed_messages (
  clerk_user_id TEXT NOT NULL,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT,
  processed_at TEXT NOT NULL,
  PRIMARY KEY (clerk_user_id, gmail_message_id),
  FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pubsub_deliveries (
  pubsub_message_id TEXT PRIMARY KEY,
  google_email TEXT NOT NULL,
  history_id TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction_heads (
  clerk_user_id TEXT PRIMARY KEY,
  current_r2_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_google_email ON users(google_email);
CREATE INDEX IF NOT EXISTS idx_users_google_auth_status ON users(google_auth_status);
CREATE INDEX IF NOT EXISTS idx_watch_expiration ON gmail_watch_state(watch_expiration_at);
