-- Add reward_expires_at to track when referral reward plans should expire
alter table users
  add column if not exists reward_expires_at timestamptz default null;
