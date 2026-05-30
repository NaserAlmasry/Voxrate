-- Scheduled overnight bulk analysis jobs (Pro plan)
CREATE TABLE IF NOT EXISTS scheduled_bulk_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asins         TEXT[] NOT NULL,
  marketplace   TEXT NOT NULL DEFAULT 'amazon.com',
  schedule_time TIME NOT NULL DEFAULT '02:00',
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_bulk_jobs_user ON scheduled_bulk_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_bulk_jobs_enabled ON scheduled_bulk_jobs(enabled) WHERE enabled = TRUE;

ALTER TABLE scheduled_bulk_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_scheduled_bulk_jobs" ON scheduled_bulk_jobs
  FOR ALL USING (auth.uid() = user_id);
