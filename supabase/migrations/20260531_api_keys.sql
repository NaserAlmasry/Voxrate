-- Public API key for programmatic access (Pro plan)
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key) WHERE api_key IS NOT NULL;
