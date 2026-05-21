-- ============================================================
-- supabase/add_indexes.sql
--
-- Performance indexes for the most-queried columns in Voxrate.
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

-- reports table: queried by user_id constantly (history, library, shop-health)
CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports(user_id);
CREATE INDEX IF NOT EXISTS reports_user_id_created_at_idx ON reports(user_id, created_at DESC);

-- watchlist: queried by user_id
CREATE INDEX IF NOT EXISTS watchlist_user_id_idx ON watchlist(user_id);

-- sentiment_alerts: cron queries by next_run_at and active
CREATE INDEX IF NOT EXISTS sentiment_alerts_next_run_at_idx ON sentiment_alerts(next_run_at) WHERE active = true;

-- monitored_listings: queried by user_id and next_check_at
CREATE INDEX IF NOT EXISTS monitored_listings_user_id_idx ON monitored_listings(user_id);
CREATE INDEX IF NOT EXISTS monitored_listings_next_check_at_idx ON monitored_listings(next_check_at);

-- asin_review_cache: queried by asin + domain
CREATE INDEX IF NOT EXISTS asin_review_cache_asin_domain_idx ON asin_review_cache(asin, domain);

-- usage_logs: if table exists
CREATE INDEX IF NOT EXISTS usage_logs_user_id_idx ON usage_logs(user_id);
