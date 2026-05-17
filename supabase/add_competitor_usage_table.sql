-- Tracks per-product competitor analysis usage for monthly limits
create table if not exists competitor_usage (
  id                   uuid default gen_random_uuid() primary key,
  user_id              uuid not null,
  own_report_id        uuid references reports(id) on delete set null,
  competitor_report_id uuid references reports(id) on delete set null,
  created_at           timestamptz default now()
);

create index if not exists competitor_usage_user_idx on competitor_usage(user_id, created_at desc);
create index if not exists competitor_usage_own_idx  on competitor_usage(own_report_id, created_at desc);
