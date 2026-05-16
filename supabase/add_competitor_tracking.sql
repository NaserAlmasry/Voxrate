-- Add competitor analysis tracking columns to users table
alter table users
  add column if not exists competitor_analyses_used integer not null default 0,
  add column if not exists free_competitor_used boolean not null default false;
