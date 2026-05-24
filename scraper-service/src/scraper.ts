import type { ScrapeRequest, Review } from './types.js'

const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY!
const DATASET_ID         = 'gd_le8e811kzy4ggddlq'
const BASE_URL           = 'https://api.brightdata.com/datasets/v3'

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

async function triggerSnapshot(productUrl: string, excludeIds: string[]): Promise<string | null> {
  const body: Record<string, unknown> = { url: productUrl }
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

export async function scrape(req: ScrapeRequest): Promise<Review[]> {
  const tld        = req.marketplace.replace(/^amazon\./, '')
  const productUrl = `https://www.amazon.${tld}/dp/${req.asin}/`

  console.log(`[Scraper] ${req.asin} — target ${req.maxReviews} reviews via async Dataset API`)

  const allReviews: Review[] = []
  const seenIds    = new Set<string>()
  const excludeIds: string[] = []
  const MAX_ROUNDS = 10

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (allReviews.length >= req.maxReviews) break

    console.log(`[Scraper] Round ${round} — fetching, excluding ${excludeIds.length} known IDs`)

    const snapshotId = await triggerSnapshot(productUrl, excludeIds)
    if (!snapshotId) break

    const rows = await pollSnapshot(snapshotId)
    if (rows.length === 0) {
      console.log(`[Scraper] No rows in round ${round} — stopping`)
      break
    }

    let newCount = 0
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i]
      const rid = raw.review_id ?? raw.id
      if (rid) excludeIds.push(rid)

      const review = mapReview(raw, req.asin, tld, i)
      if (review && !seenIds.has(review.id)) {
        seenIds.add(review.id)
        allReviews.push(review)
        newCount++
      }
    }

    console.log(`[Scraper] Round ${round} → ${newCount} new reviews (total: ${allReviews.length}/${req.maxReviews})`)

    if (newCount === 0) {
      console.log(`[Scraper] No new reviews in round ${round} — end of available reviews`)
      break
    }
  }

  return allReviews.slice(0, req.maxReviews)
}
