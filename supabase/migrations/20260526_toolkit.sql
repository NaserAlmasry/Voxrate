-- Monitored ASINs watchlist
create table if not exists monitored_asins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  asin         text not null,
  marketplace  text not null default 'amazon.com',
  product_name text,
  main_image   text,
  is_own_product boolean default true,
  created_at   timestamptz not null default now(),
  unique(user_id, asin)
);
create index if not exists monitored_asins_user_idx on monitored_asins(user_id);

-- Alerts
create table if not exists alerts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,
  severity   text not null default 'warning',
  title      text not null,
  body       text not null,
  asin       text,
  data       jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists alerts_user_unread_idx on alerts(user_id, read, created_at);

-- Listing snapshots for change detection
create table if not exists listing_snapshots (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  asin           text not null,
  marketplace    text not null default 'amazon.com',
  title          text,
  bullets        jsonb,
  main_image     text,
  price          numeric,
  review_count   integer,
  average_rating numeric,
  buy_box_seller text,
  is_suppressed  boolean default false,
  captured_at    timestamptz not null default now()
);
create index if not exists listing_snapshots_user_asin_idx on listing_snapshots(user_id, asin, captured_at desc);

-- SC scan results
create table if not exists sc_scans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  scan_type  text not null,
  data       jsonb not null,
  scanned_at timestamptz not null default now()
);
create index if not exists sc_scans_user_type_idx on sc_scans(user_id, scan_type, scanned_at desc);

-- Review velocity tracking
create table if not exists review_velocity (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  asin            text not null,
  date            date not null default current_date,
  one_star        integer default 0,
  two_star        integer default 0,
  three_star      integer default 0,
  four_star       integer default 0,
  five_star       integer default 0,
  total           integer default 0,
  unique(user_id, asin, date)
);

-- RLS
alter table monitored_asins enable row level security;
alter table alerts enable row level security;
alter table listing_snapshots enable row level security;
alter table sc_scans enable row level security;
alter table review_velocity enable row level security;

create policy "Users own their monitored asins" on monitored_asins for all using (auth.uid() = user_id);
create policy "Users own their alerts" on alerts for all using (auth.uid() = user_id);
create policy "Users own their snapshots" on listing_snapshots for all using (auth.uid() = user_id);
create policy "Users own their sc scans" on sc_scans for all using (auth.uid() = user_id);
create policy "Users own their velocity" on review_velocity for all using (auth.uid() = user_id);
