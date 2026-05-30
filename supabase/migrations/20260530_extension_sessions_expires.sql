-- Add missing expires_at column to extension_sessions
ALTER TABLE extension_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Set default expiry for existing sessions (30 days from now)
UPDATE extension_sessions
SET expires_at = NOW() + INTERVAL '30 days'
WHERE expires_at IS NULL;
