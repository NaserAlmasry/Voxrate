-- Mark watchlist items as competitor-tracked for weekly re-analysis alerts
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS is_competitor BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS alert_on_change BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_watchlist_is_competitor ON watchlist(is_competitor) WHERE is_competitor = TRUE;
