-- Amazon SP-API OAuth columns on users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS amazon_sp_refresh_token     TEXT,
  ADD COLUMN IF NOT EXISTS amazon_sp_selling_partner_id TEXT,
  ADD COLUMN IF NOT EXISTS amazon_sp_region             TEXT,
  ADD COLUMN IF NOT EXISTS amazon_sp_api_url            TEXT,
  ADD COLUMN IF NOT EXISTS amazon_sp_connected_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS amazon_sp_last_sync          TIMESTAMPTZ;

-- Temporary OAuth state table (10-min TTL, cleaned up after use)
CREATE TABLE IF NOT EXISTS amazon_oauth_states (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-clean expired states daily (Supabase cron or pg_cron)
-- Row-level security: users can only see their own states
ALTER TABLE amazon_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own oauth states"
  ON amazon_oauth_states FOR ALL
  USING (user_id = auth.uid());

-- Service role can read/write all states (for callback validation)
CREATE POLICY "Service role full access to oauth states"
  ON amazon_oauth_states FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast state lookup in callback
CREATE INDEX IF NOT EXISTS idx_amazon_oauth_states_state ON amazon_oauth_states(state);

-- RLS on sc_scans if not already set
ALTER TABLE sc_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users see own sc_scans"
  ON sc_scans FOR SELECT
  USING (user_id = auth.uid());
