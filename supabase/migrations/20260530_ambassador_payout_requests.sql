-- Remove paypal_email (no longer needed)
ALTER TABLE ambassadors
  DROP COLUMN IF EXISTS paypal_email,
  DROP COLUMN IF EXISTS paypal_email_verified,
  DROP COLUMN IF EXISTS paypal_email_updated_at;

-- Add payout request tracking
ALTER TABLE ambassadors
  ADD COLUMN IF NOT EXISTS payout_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_request_status TEXT NOT NULL DEFAULT 'none'
    CHECK (payout_request_status IN ('none', 'requested', 'paid')),
  ADD COLUMN IF NOT EXISTS payout_admin_note TEXT;

-- Payout history table
CREATE TABLE IF NOT EXISTS ambassador_payout_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS on payout history
ALTER TABLE ambassador_payout_history ENABLE ROW LEVEL SECURITY;
-- No client-side policies — all access via service role only
