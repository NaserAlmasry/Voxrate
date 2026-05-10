-- Run this in your Supabase SQL editor to enable score delta + sparkline history

-- 1. Add initial_score to watchlist (score at time of first add — never changes)
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS initial_score INTEGER;
-- Backfill existing rows
UPDATE watchlist SET initial_score = last_score WHERE initial_score IS NULL;

-- 2. Score history for sparkline
CREATE TABLE IF NOT EXISTS watchlist_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL REFERENCES watchlist(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_watchlist_history_wid ON watchlist_history(watchlist_id);
-- Seed initial history from current last_score so charts have a starting point
INSERT INTO watchlist_history (watchlist_id, score, checked_at)
SELECT id, last_score, COALESCE(last_checked_at, NOW()) FROM watchlist
WHERE last_score IS NOT NULL
ON CONFLICT DO NOTHING;
