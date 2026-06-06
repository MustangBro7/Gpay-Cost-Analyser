ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user'));

CREATE TABLE IF NOT EXISTS ai_agent_evals (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  clerk_email TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('gmail', 'preview')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  model TEXT,
  email_timestamp TEXT,
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  input_body TEXT NOT NULL,
  prompt TEXT,
  ai_output TEXT,
  parsed_output_json TEXT,
  final_transaction_json TEXT,
  error_message TEXT,
  latency_ms INTEGER,
  used_custom_rules INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_evals_created_at ON ai_agent_evals(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_evals_clerk_user_id ON ai_agent_evals(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_evals_status ON ai_agent_evals(status);
