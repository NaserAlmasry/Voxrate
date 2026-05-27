-- Emergency re-analyze overrides
-- Each user gets 1 override per month, reset by the renewal cron.
-- Allows bypassing the re-analyze cooldown once per month.

alter table users
  add column if not exists reanalyze_overrides integer not null default 1;

-- Grant 1 override to existing users on paid plans who don't already have one
update users
  set reanalyze_overrides = 1
  where plan in ('starter', 'growth', 'pro')
    and reanalyze_overrides = 0;

-- Reset overrides to 1 each month as part of the renewal cycle.
-- Called inside renew_analyses_with_rollover or separately from the billing webhook.
create or replace function reset_reanalyze_override(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update users
    set reanalyze_overrides = 1
    where id = p_user_id
      and plan in ('starter', 'growth', 'pro');
end;
$$;
