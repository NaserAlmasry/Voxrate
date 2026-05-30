CREATE OR REPLACE FUNCTION mark_ambassador_paid(
  p_ambassador_id UUID,
  p_amount NUMERIC,
  p_admin_note TEXT,
  p_paid_at TIMESTAMPTZ
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ambassador_payout_history(ambassador_id, amount, paid_at, admin_note)
  VALUES (p_ambassador_id, p_amount, p_paid_at, p_admin_note);

  UPDATE ambassador_conversions
  SET status = 'paid', paid_out_at = p_paid_at
  WHERE ambassador_id = p_ambassador_id AND status = 'payable';

  UPDATE ambassadors
  SET payout_request_status = 'none',
      payout_requested_at = NULL,
      payout_admin_note = NULL
  WHERE id = p_ambassador_id;
END;
$$;
