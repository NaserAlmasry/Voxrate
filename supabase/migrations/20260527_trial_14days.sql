-- Trial: 14 days, 3 own analyses, 2 competitor analyses
create or replace function activate_free_trial(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  if exists (select 1 from users where id = p_user_id and trial_activated = true) then return; end if;
  update users set
    trial_ends_at                  = now() + interval '14 days',
    trial_activated                = true,
    own_analyses_remaining         = greatest(own_analyses_remaining, 3),
    competitor_analyses_remaining  = greatest(competitor_analyses_remaining, 2)
  where id = p_user_id;
end;
$$;
