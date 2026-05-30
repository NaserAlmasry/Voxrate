-- Add ASIN column to reports for efficient same-product diff queries
ALTER TABLE reports ADD COLUMN IF NOT EXISTS asin TEXT;
CREATE INDEX IF NOT EXISTS idx_reports_user_asin ON reports(user_id, asin, created_at DESC);
