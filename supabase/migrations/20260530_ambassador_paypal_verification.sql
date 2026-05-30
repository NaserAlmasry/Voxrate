-- Add PayPal email verification tracking to ambassadors
ALTER TABLE ambassadors
  ADD COLUMN IF NOT EXISTS paypal_email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paypal_email_updated_at TIMESTAMPTZ;

-- When paypal_email changes, reset verification and record timestamp
CREATE OR REPLACE FUNCTION reset_paypal_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.paypal_email IS DISTINCT FROM NEW.paypal_email THEN
    NEW.paypal_email_verified := false;
    NEW.paypal_email_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_paypal_verification ON ambassadors;
CREATE TRIGGER trg_reset_paypal_verification
  BEFORE UPDATE ON ambassadors
  FOR EACH ROW
  EXECUTE FUNCTION reset_paypal_verification();
