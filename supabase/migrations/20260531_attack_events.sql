-- Store detected review attack events per monitored listing
CREATE TABLE IF NOT EXISTS attack_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id       UUID NOT NULL REFERENCES monitored_listings(id) ON DELETE CASCADE,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  new_negative_count INT NOT NULL DEFAULT 0,
  is_coordinated   BOOLEAN NOT NULL DEFAULT FALSE,
  shared_phrases   TEXT[] NOT NULL DEFAULT '{}',
  severity         TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high'))
);
CREATE INDEX IF NOT EXISTS idx_attack_events_listing ON attack_events(listing_id, detected_at DESC);
