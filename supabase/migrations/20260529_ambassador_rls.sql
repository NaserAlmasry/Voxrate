-- RLS for ambassador tables: deny all anon/authenticated direct access
-- All reads/writes go through the service-role admin client server-side

alter table ambassador_codes       enable row level security;
alter table ambassadors            enable row level security;
alter table ambassador_clicks      enable row level security;
alter table ambassador_conversions enable row level security;
alter table ambassador_payouts     enable row level security;
alter table ambassador_attribution enable row level security;

-- No policies = deny by default for anon and authenticated roles
-- Service role bypasses RLS automatically
