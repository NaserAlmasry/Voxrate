import type { ScrapeRequest, Review } from './types.js'

const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY!
const DATASET_ID         = 'gd_le8e811kzy4ggddlq'
const BASE_URL           = 'https://api.brightdata.com/datasets/v3'
const BATCH_SIZE         = 50

interface BDReview {
  review_id?:          string
  id?:                 string
  rating?:             number | string
  title?:              string
  review_text?:        string
  body?:               string
  review_body?:        string
  content?:            string
  review_posted_date?: string
  review_date?:        string
  date?:               string
  is_verified?:        boolean
  verified_purchase?:  boolean | string
  verified?:           boolean | string
  helpful_count?:      number
  helpful_votes?:      number | string
  helpful?:            number | string
  review_country?:     string
  country?:            string
  marketplace?:        string
  error?:              string
  error_code?:         string
}

function mapReview(raw: BDReview, asin: string, tld: string, index: number): Review | null {
  if (raw.error_code) return null

  const id     = raw.review_id ?? raw.id ?? `bd-${asin}-${Date.now()}-${index}`
  const rating = Math.round(parseFloat(String(raw.rating ?? 0)))
  if (rating > 5) return null

  const body = raw.review_text ?? raw.body ?? raw.review_body ?? raw.content ?? ''
  if (body.length < 20) return null

  const title    = raw.title ?? ''
  const date     = raw.review_posted_date ?? raw.review_date ?? raw.date ?? ''
  const verified = Boolean(raw.is_verified ?? raw.verified_purchase ?? raw.verified ?? false)
  const helpful  = parseInt(String(raw.helpful_count ?? raw.helpful_votes ?? raw.helpful ?? 0)) || 0
  const country  = raw.review_country ?? raw.country ?? raw.marketplace ?? tld

  return { id, rating, title, body, date, verified, helpful, country }
}

async function triggerSnapshot(productUrl: string, excludeIds: string[], maxReviews: number): Promise<string | null> {
  const body: Record<string, unknown> = { url: productUrl, max_reviews: maxReviews }
  if (excludeIds.length > 0) body.reviews_to_not_include = excludeIds

  const res = await fetch(`${BASE_URL}/trigger?dataset_id=${DATASET_ID}&notify=false&include_errors=true&format=json`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify([body]),
  })

  if (!res.ok) {
    console.error(`[Scraper] Trigger error ${res.status}: ${await res.text().catch(() => '')}`)
    return null
  }

  const data = await res.json() as { snapshot_id?: string }
  console.log(`[Scraper] Snapshot triggered: ${data.snapshot_id}`)
  return data.snapshot_id ?? null
}

async function pollSnapshot(snapshotId: string, timeoutMs = 120_000): Promise<BDReview[]> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000))

    const res = await fetch(`${BASE_URL}/snapshot/${snapshotId}?format=json`, {
      headers: { 'Authorization': `Bearer ${BRIGHTDATA_API_KEY}` },
    })

    if (res.status === 202) {
      console.log(`[Scraper] Snapshot ${snapshotId} still processing...`)
      continue
    }

    if (!res.ok) {
      console.error(`[Scraper] Snapshot error ${res.status}`)
      return []
    }

    const data = await res.json()
    const rows: BDReview[] = Array.isArray(data) ? data : (data?.reviews ?? [])
    console.log(`[Scraper] Snapshot ${snapshotId} done — ${rows.length} rows`)
    return rows
  }

  console.error(`[Scraper] Snapshot ${snapshotId} timed out`)
  return []
}

async function fetchBatch(productUrl: string, excludeIds: string[], tld: string, asin: string, offset: number): Promise<Review[]> {
  const snapshotId = await triggerSnapshot(productUrl, excludeIds, BATCH_SIZE)
  if (!snapshotId) return []

  const rows = await pollSnapshot(snapshotId, 90_000)
  console.log(`[Scraper] Batch offset=${offset} — ${rows.length} raw rows`)

  const reviews: Review[] = []
  for (let i = 0; i < rows.length; i++) {
    const review = mapReview(rows[i], asin, tld, offset + i)
    if (review) reviews.push(review)
  }
  return reviews
}

export async function scrape(req: ScrapeRequest): Promise<Review[]> {
  const tld        = req.marketplace.replace(/^amazon\./, '')
  const productUrl = `https://www.amazon.${tld}/dp/${req.asin}/`
  const target     = req.maxReviews ?? BATCH_SIZE

  console.log(`[Scraper] ${req.asin} — targeting ${target} reviews in batches of ${BATCH_SIZE}`)

  const allReviews: Review[] = []
  const seenIds = new Set<string>()
  const maxRounds = Math.ceil(target / BATCH_SIZE)

  for (let round = 0; round < maxRounds && allReviews.length < target; round++) {
    const excludeIds = allReviews.map(r => r.id)
    console.log(`[Scraper] ${req.asin} round ${round + 1}/${maxRounds} — excluding ${excludeIds.length} ids`)

    const batch = await fetchBatch(productUrl, excludeIds, tld, req.asin, allReviews.length)

    if (batch.length === 0) {
      console.log(`[Scraper] ${req.asin} — empty batch, stopping early`)
      break
    }

    for (const review of batch) {
      if (!seenIds.has(review.id)) {
        seenIds.add(review.id)
        allReviews.push(review)
      }
    }

    console.log(`[Scraper] ${req.asin} — ${allReviews.length} total so far`)
  }

  console.log(`[Scraper] ${req.asin} → ${allReviews.length} mapped reviews`)
  return allReviews.slice(0, target)
}
