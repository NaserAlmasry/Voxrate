-- Separate subscription credits from pack (one-time purchase) credits.
-- This allows renewal to reset only the subscription portion while preserving
-- paid pack credits, and allows cancellation to zero subscription credits
-- without wiping purchased packs.

-- 1. New column — tracks only the pack-purchased portion of the credit balance
alter table users
  add column if not exists pack_credits integer not null default 0;

-- 2. RPC for pack credit purchases — increments both the spendable total
--    (credits) and the pack tracking column (pack_credits).
--    Call this from the webhook on credit_pack checkout.session.completed.
create or replace function add_pack_credits(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
as $$
begin
  update users
  set
    credits      = credits      + p_amount,
    pack_credits = pack_credits + p_amount
  where id = p_user_id;
end;
$$;

-- 3. Grant execute to authenticated and service roles
grant execute on function add_pack_credits(uuid, integer) to authenticated;
grant execute on function add_pack_credits(uuid, integer) to service_role;
