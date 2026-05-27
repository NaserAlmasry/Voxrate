-- ============================================================
-- Analyses model: replace credits with own/competitor analyses
-- + rollover + digest frequency preference
-- ============================================================

alter table users
  add column if not exists own_analyses_remaining      integer not null default 0,
  add column if not exists competitor_analyses_remaining integer not null default 0,
  add column if not exists digest_frequency            text    not null default 'weekly';

-- Migrate existing credit balances to analyses (20 credits = 1 own analysis)
update users
set own_analyses_remaining = greatest(0, floor(credits::numeric / 20)::integer)
where own_analyses_remaining = 0 and credits > 0;

-- Seed free plan users with their 1 lifetime analysis if not already done
update users
set own_analyses_remaining = 1
where plan = 'free' and own_analyses_remaining = 0 and credits <= 0;

-- ── RPCs ──────────────────────────────────────────────────────

-- Deduct 1 own analysis atomically; returns false if none remaining
create or replace function deduct_own_analysis(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_remaining integer;
begin
  select own_analyses_remaining into v_remaining
  from users where id = p_user_id for update;
  if coalesce(v_remaining, 0) <= 0 then return false; end if;
  update users set own_analyses_remaining = own_analyses_remaining - 1
  where id = p_user_id;
  return true;
end;
$$;

-- Deduct 1 competitor analysis atomically; returns false if none remaining
create or replace function deduct_competitor_analysis(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_remaining integer;
begin
  select competitor_analyses_remaining into v_remaining
  from users where id = p_user_id for update;
  if coalesce(v_remaining, 0) <= 0 then return false; end if;
  update users set competitor_analyses_remaining = competitor_analyses_remaining - 1
  where id = p_user_id;
  return true;
end;
$$;

-- Refund 1 own analysis (used on analysis failure)
create or replace function refund_own_analysis(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update users set own_analyses_remaining = own_analyses_remaining + 1
  where id = p_user_id;
end;
$$;

-- Refund 1 competitor analysis (used on analysis failure)
create or replace function refund_competitor_analysis(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update users set competitor_analyses_remaining = competitor_analyses_remaining + 1
  where id = p_user_id;
end;
$$;

-- Renewal with rollover: adds monthly allotment, caps at rollover_cap * monthly
create or replace function renew_analyses_with_rollover(
  p_user_id              uuid,
  p_own_monthly          integer,
  p_competitor_monthly   integer,
  p_rollover_cap         integer
)
returns void
language plpgsql
security definer
as $$
declare
  v_own        integer;
  v_competitor integer;
begin
  select own_analyses_remaining, competitor_analyses_remaining
  into v_own, v_competitor
  from users where id = p_user_id for update;

  update users set
    own_analyses_remaining        = least(coalesce(v_own, 0) + p_own_monthly,        p_own_monthly        * p_rollover_cap),
    competitor_analyses_remaining = least(coalesce(v_competitor, 0) + p_competitor_monthly, p_competitor_monthly * p_rollover_cap)
  where id = p_user_id;
end;
$$;
