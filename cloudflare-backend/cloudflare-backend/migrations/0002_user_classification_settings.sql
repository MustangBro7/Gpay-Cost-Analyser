CREATE TABLE IF NOT EXISTS user_classification_settings (
  clerk_user_id TEXT PRIMARY KEY,
  categories_json TEXT NOT NULL,
  rules_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);
