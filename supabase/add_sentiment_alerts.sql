-- Sentiment Alerts (Feature 2)
-- Growth and Pro plan users get scheduled scans for new 1★/2★ reviews,
-- emailed via Resend. Credits deducted when the alert RUNS (not on setup).
--
-- Credit cost per run:
--   weekly     = 5
--   biweekly   = 10
--   triweekly  = 12
--   monthly    = 15

create table if not exists sentiment_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  asin text not null,
  product_name text,
  marketplace text default 'amazon.com',
  frequency text not null check (frequency in ('weekly','biweekly','triweekly','monthly')),
  active boolean default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists sentiment_alerts_user_id_idx on sentiment_alerts(user_id);
create index if not exists sentiment_alerts_next_run_idx on sentiment_alerts(next_run_at) where active = true;
