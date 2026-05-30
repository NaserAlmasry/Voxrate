-- Add columns needed for immediate 1★/2★ alert diffing and reply links
ALTER TABLE monitored_listings ADD COLUMN IF NOT EXISTS asin TEXT;
ALTER TABLE monitored_listings ADD COLUMN IF NOT EXISTS marketplace TEXT DEFAULT 'amazon.com';

-- Backfill ASIN from product_url
UPDATE monitored_listings
SET asin = (regexp_match(product_url, '/dp/([A-Z0-9]{10})'))[1]
WHERE asin IS NULL AND product_url ~ '/dp/[A-Z0-9]{10}';

-- Backfill marketplace from product_url
UPDATE monitored_listings
SET marketplace = regexp_replace(
      regexp_replace(product_url, '^https?://(www\.)?', ''),
      '/.*$', ''
    )
WHERE marketplace IS NULL AND product_url IS NOT NULL;
