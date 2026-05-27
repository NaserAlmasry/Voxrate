-- Free trial: 14-day Starter-level access on signup
alter table users
  add column if not exists trial_ends_at  timestamptz default null,
  add column if not exists trial_activated boolean not null default false;

-- Helper: check if a user currently has an active trial
create or replace function is_trial_active(p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from users
    where id = p_user_id
      and plan = 'free'
      and trial_ends_at is not null
      and trial_ends_at > now()
  );
$$;

-- Called on first signup to activate the trial
create or replace function activate_free_trial(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update users set
    trial_ends_at         = now() + interval '14 days',
    trial_activated       = true,
    own_analyses_remaining        = 10,
    competitor_analyses_remaining = 2
  where id = p_user_id
    and trial_activated = false;  -- idempotent
end;
$$;

-- Called by expiry cron to downgrade expired trials
create or replace function expire_free_trials()
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  update users set
    own_analyses_remaining        = 0,
    competitor_analyses_remaining = 0,
    trial_ends_at                 = null
  where plan = 'free'
    and trial_ends_at is not null
    and trial_ends_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
