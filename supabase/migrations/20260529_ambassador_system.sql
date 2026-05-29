CREATE TABLE ambassador_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ambassador', 'pro_access')),
  assigned_name TEXT,
  assigned_email TEXT,
  used BOOLEAN DEFAULT false,
  used_by_ambassador_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE ambassadors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  code_used TEXT NOT NULL REFERENCES ambassador_codes(code),
  referral_code TEXT UNIQUE NOT NULL,
  invited_by_ambassador_id UUID REFERENCES ambassadors(id),
  friend_invited_id UUID REFERENCES ambassadors(id),
  friend_bonus_active BOOLEAN DEFAULT false,
  commission_rate NUMERIC(5,2) DEFAULT 30.00,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired')),
  pro_access BOOLEAN DEFAULT false,
  session_token TEXT UNIQUE,
  session_expires_at TIMESTAMPTZ,
  internship_start TIMESTAMPTZ DEFAULT now(),
  internship_end TIMESTAMPTZ DEFAULT now() + INTERVAL '3 months',
  paypal_email TEXT,
  notes TEXT,
  last_email_day INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ambassador_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES ambassadors(id),
  ip_hash TEXT,
  user_agent_hash TEXT,
  clicked_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ambassador_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES ambassadors(id),
  subscriber_email TEXT NOT NULL,
  stripe_customer_id TEXT,
  plan TEXT,
  plan_price NUMERIC(10,2),
  commission_rate NUMERIC(5,2),
  commission_amount NUMERIC(10,2),
  friend_bonus_amount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'payable', 'paid', 'flagged')),
  signed_up_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  payable_at TIMESTAMPTZ,
  paid_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ambassador_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES ambassadors(id),
  period TEXT NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ambassador_id, period)
);

CREATE TABLE ambassador_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_email TEXT UNIQUE NOT NULL,
  referral_code TEXT NOT NULL,
  ambassador_id UUID NOT NULL REFERENCES ambassadors(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ambassadors_referral_code ON ambassadors(referral_code);
CREATE INDEX idx_ambassadors_session_token ON ambassadors(session_token);
CREATE INDEX idx_ambassador_clicks_ambassador_id ON ambassador_clicks(ambassador_id);
CREATE INDEX idx_ambassador_conversions_ambassador_id ON ambassador_conversions(ambassador_id);
CREATE INDEX idx_ambassador_attribution_email ON ambassador_attribution(subscriber_email);
CREATE INDEX idx_ambassador_attribution_referral_code ON ambassador_attribution(referral_code);
