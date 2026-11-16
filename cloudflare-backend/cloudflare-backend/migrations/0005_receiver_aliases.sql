-- User-chosen display names for payees. Incoming transactions whose parsed receiver matches
-- receiver_key are stored under display_name instead.
CREATE TABLE IF NOT EXISTS receiver_aliases (
  clerk_user_id TEXT NOT NULL,
  receiver_key TEXT NOT NULL,
  receiver_label TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (clerk_user_id, receiver_key),
  FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);
