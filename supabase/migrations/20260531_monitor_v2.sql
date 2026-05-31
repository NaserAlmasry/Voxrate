ALTER TABLE monitored_listings
  ADD COLUMN IF NOT EXISTS asin text,
  ADD COLUMN IF NOT EXISTS marketplace text DEFAULT 'amazon.com',
  ADD COLUMN IF NOT EXISTS last_review_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_one_star_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_two_star_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_rating numeric(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_check_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS check_interval_days integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS known_negative_ids jsonb DEFAULT '[]'::jsonb;
