CREATE TABLE IF NOT EXISTS public_geo_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id         UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug              TEXT UNIQUE NOT NULL,
  published         BOOLEAN NOT NULL DEFAULT false,
  seller_bio        TEXT CHECK (char_length(seller_bio) <= 500),
  amazon_url        TEXT NOT NULL,
  -- Locked snapshot fields (copied from report at publish time)
  health_score      SMALLINT NOT NULL,
  product_title     TEXT NOT NULL,
  product_image     TEXT,
  asin              TEXT,
  marketplace       TEXT NOT NULL DEFAULT 'amazon.com',
  star_breakdown    JSONB NOT NULL DEFAULT '{}',
  complaints        JSONB NOT NULL DEFAULT '[]',
  strengths         JSONB NOT NULL DEFAULT '[]',
  buyer_phrases     JSONB NOT NULL DEFAULT '[]',
  summary           TEXT,
  total_reviews     INTEGER NOT NULL DEFAULT 0,
  avg_rating        NUMERIC(3,1),
  category          TEXT,
  -- Show/hide preferences (seller choices)
  show_complaints   BOOLEAN NOT NULL DEFAULT true,
  show_strengths    BOOLEAN NOT NULL DEFAULT true,
  -- Plan at publish time
  plan_at_publish   TEXT,
  -- Meta
  published_at      TIMESTAMPTZ,
  last_snapshot_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  view_count        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_geo_pages_slug       ON public_geo_pages(slug);
CREATE INDEX IF NOT EXISTS idx_geo_pages_user_id           ON public_geo_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_geo_pages_report_id         ON public_geo_pages(report_id);
CREATE INDEX IF NOT EXISTS idx_geo_pages_published         ON public_geo_pages(published) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_geo_pages_asin              ON public_geo_pages(asin) WHERE asin IS NOT NULL;

-- View tracking table
CREATE TABLE IF NOT EXISTS geo_page_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     UUID NOT NULL REFERENCES public_geo_pages(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  referrer    TEXT,
  source      TEXT -- 'perplexity', 'google', 'reddit', 'direct', 'other'
);

CREATE INDEX IF NOT EXISTS idx_geo_views_page_id ON geo_page_views(page_id, viewed_at DESC);

-- RLS
ALTER TABLE public_geo_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_page_views   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all"   ON public_geo_pages;
DROP POLICY IF EXISTS "public_read" ON public_geo_pages;

CREATE POLICY "owner_all"   ON public_geo_pages FOR ALL    USING (user_id = auth.uid());
CREATE POLICY "public_read" ON public_geo_pages FOR SELECT USING (published = true);

-- geo_page_views: service role only (we insert via admin client)
CREATE POLICY "service_insert" ON geo_page_views FOR INSERT WITH CHECK (true);
CREATE POLICY "owner_select"   ON geo_page_views FOR SELECT USING (
  page_id IN (SELECT id FROM public_geo_pages WHERE user_id = auth.uid())
);
