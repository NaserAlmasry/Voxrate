-- Add email_alerts_enabled toggle to watchlist items
-- Default true so existing users stay opted in

ALTER TABLE watchlist
  ADD COLUMN IF NOT EXISTS email_alerts_enabled boolean NOT NULL DEFAULT true;
