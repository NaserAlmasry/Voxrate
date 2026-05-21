CREATE TABLE IF NOT EXISTS usage_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  asin text,
  scraper_provider text,      -- 'canopy', 'scrapingdog', 'scraperapi', 'cache'
  scraper_pages int DEFAULT 0, -- how many pages were fetched
  from_cache boolean DEFAULT false,
  report_type text,           -- 'own' or 'competitor'
  credit_cost int,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_costs_user_id_idx ON usage_costs(user_id);
CREATE INDEX IF NOT EXISTS usage_costs_created_at_idx ON usage_costs(created_at);
