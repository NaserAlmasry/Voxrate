-- Chrome Extension integration tables

-- Stores the extension token for each user + tracks last heartbeat
create table if not exists extension_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null unique,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(user_id)
);

create index if not exists extension_sessions_user_id_idx on extension_sessions(user_id);
create index if not exists extension_sessions_token_idx on extension_sessions(token);

-- Scrape jobs queued by the backend and picked up by the extension
create table if not exists extension_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  asin         text not null,
  marketplace  text not null default 'amazon.com',
  max_reviews  int not null default 150,
  status       text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'partial', 'failed', 'amazon_not_logged_in')),
  reviews      jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  completed_at timestamptz
);

create index if not exists extension_jobs_user_pending_idx on extension_jobs(user_id, status, created_at)
  where status = 'pending';

-- RLS: service role only (extension API uses service role key)
alter table extension_sessions enable row level security;
alter table extension_jobs enable row level security;

-- No user-facing RLS policies needed — all access goes through service role API routes
