import type { ScrapeRequest, Review } from './types.js'

const APIFY_TOKEN  = process.env.APIFY_TOKEN!
const ACTOR_ID     = 'junglee~amazon-reviews-scraper'
const APIFY_BASE   = 'https://api.apify.com/v2'

interface ApifyReview {
  reviewId?:          string
  ratingScore?:       number
  reviewTitle?:       string
  reviewDescription?: string
  date?:              string
  isVerified?:        boolean
  reviewReaction?:    string | number
  country?:           string
  reviewedIn?:        string
}

function mapReview(raw: ApifyReview): Review | null {
  const id     = raw.reviewId ?? ''
  if (!id) return null

  const rating = Math.round(raw.ratingScore ?? 0)
  const body   = raw.reviewDescription ?? ''
  if (body.length < 20) return null

  const helpful = typeof raw.reviewReaction === 'string'
    ? parseInt(raw.reviewReaction.replace(/[^0-9]/g, '')) || 0
    : (raw.reviewReaction ?? 0)

  const country = raw.reviewedIn?.replace(/^Reviewed in (.+?) on.*$/, '$1')
    ?? raw.country
    ?? ''

  return {
    id,
    rating,
    title:    raw.reviewTitle ?? '',
    body,
    date:     raw.date ?? '',
    verified: raw.isVerified ?? false,
    helpful:  Number(helpful) || 0,
    country,
  }
}

export async function scrape(req: ScrapeRequest): Promise<Review[]> {
  const tld        = req.marketplace.replace(/^amazon\./, '')
  const productUrl = `https://www.amazon.${tld}/dp/${req.asin}/`
  const target     = req.maxReviews ?? 100

  console.log(`[Scraper] ${req.asin} — requesting ${target} reviews via Apify`)

  const res = await fetch(
    `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        productUrls: [{ url: productUrl }],
        maxReviews:  target,
      }),
      signal: AbortSignal.timeout(300_000), // 5 min timeout
    }
  )

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    console.error(`[Scraper] Apify error ${res.status}: ${err}`)
    return []
  }

  const rows: ApifyReview[] = await res.json()
  console.log(`[Scraper] ${req.asin} — ${rows.length} raw rows from Apify`)

  const reviews: Review[] = []
  const seenIds = new Set<string>()

  for (const row of rows) {
    const r = mapReview(row)
    if (r && !seenIds.has(r.id)) {
      seenIds.add(r.id)
      reviews.push(r)
    }
  }

  console.log(`[Scraper] ${req.asin} → ${reviews.length} mapped reviews`)
  return reviews.slice(0, target)
}
