-- Track complaint theme percentages over time per watchlist item
CREATE TABLE IF NOT EXISTS complaint_theme_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL REFERENCES watchlist(id) ON DELETE CASCADE,
  report_id UUID NOT NULL,
  theme_name TEXT NOT NULL,
  percentage NUMERIC(5,2) NOT NULL,
  severity TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cth_watchlist ON complaint_theme_history(watchlist_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_cth_theme ON complaint_theme_history(watchlist_id, theme_name);
