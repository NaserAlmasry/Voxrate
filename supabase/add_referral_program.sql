-- ============================================================
-- REFERRAL PROGRAM — Feature 8
-- supabase/add_referral_program.sql
-- ============================================================

-- referrals table
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references users(id) on delete cascade,
  referred_user_id uuid references users(id) on delete cascade unique,
  converted boolean default false,        -- true when referred user pays
  converted_at timestamptz,
  created_at timestamptz default now()
);

-- add referral_code + paid-referral counter to users
alter table users add column if not exists referral_code text unique;
alter table users add column if not exists referral_count int default 0;

create index if not exists referrals_referrer_id_idx on referrals(referrer_id);
create index if not exists referrals_referred_user_id_idx on referrals(referred_user_id);

-- record of every claim, so we can audit / show history
create table if not exists referral_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  reward_plan text not null,              -- 'starter' | 'growth'
  referrals_used int not null,            -- snapshot of referral_count at claim time
  period_end timestamptz not null,        -- when the free month ends
  created_at timestamptz default now()
);

create index if not exists referral_claims_user_id_idx on referral_claims(user_id);

-- RPC used by the Stripe webhook to atomically bump the referrer's counter
create or replace function increment_referral_count(uid uuid)
returns void language sql as $$
  update users set referral_count = coalesce(referral_count, 0) + 1 where id = uid;
$$;
