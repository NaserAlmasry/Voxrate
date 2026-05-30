-- Add constraint to prevent commission_rate values that would overpay
ALTER TABLE ambassadors
  DROP CONSTRAINT IF EXISTS chk_commission_rate_range,
  ADD CONSTRAINT chk_commission_rate_range
    CHECK (commission_rate >= 0 AND commission_rate <= 100);
