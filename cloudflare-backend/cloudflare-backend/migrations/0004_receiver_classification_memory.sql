CREATE TABLE IF NOT EXISTS receiver_classification_memory (
  clerk_user_id TEXT NOT NULL,
  receiver_key TEXT NOT NULL,
  receiver_label TEXT NOT NULL,
  classification TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (clerk_user_id, receiver_key),
  FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_receiver_classification_memory_user_updated
  ON receiver_classification_memory(clerk_user_id, updated_at DESC);
