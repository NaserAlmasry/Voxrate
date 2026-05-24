import type { ScrapeRequest, Review } from './types.js'

const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY!
const DATASET_ID         = 'gd_le8e811kzy4ggddlq'
const SCRAPE_ENDPOINT    = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${DATASET_ID}&notify=false&include_errors=true&format=json`

// BrightData Amazon Reviews scraper raw row shape (fields may vary)
interface BDReview {
  review_id?:         string
  id?:                string
  rating?:            number | string
  star_rating?:       number | string
  review_rating?:     number | string
  title?:             string
  review_title?:      string
  body?:              string
  review_body?:       string
  review_text?:       string
  content?:           string
  date?:              string
  review_date?:       string
  review_posted_date?: string
  date_posted?:       string
  verified_purchase?: boolean | string
  verified?:          boolean | string
  is_verified?:       boolean
  helpful_votes?:     number | string
  helpful?:           number | string
  helpful_count?:     number
  country?:           string
  review_country?:    string
  marketplace?:       string
  error?:             string
  error_code?:        string
}

function mapReview(raw: BDReview, asin: string, tld: string, index: number): Review | null {
  if (raw.error_code) return null

  const id     = raw.review_id ?? raw.id ?? `bd-${asin}-${Date.now()}-${index}`
  const rating = Math.round(parseFloat(String(raw.rating ?? raw.review_rating ?? raw.star_rating ?? 0)))
  if (rating > 5) return null  // 0 = unavailable, still include the review

  const title = raw.title ?? raw.review_title ?? ''
  const body  = raw.review_text ?? raw.body ?? raw.review_body ?? raw.content ?? ''
  if (body.length < 20) return null

  const date     = raw.review_posted_date ?? raw.review_date ?? raw.date ?? raw.date_posted ?? ''
  const verified = Boolean(raw.is_verified ?? raw.verified_purchase ?? raw.verified ?? false)
  const helpful  = parseInt(String(raw.helpful_count ?? raw.helpful_votes ?? raw.helpful ?? 0)) || 0
  const country  = raw.review_country ?? raw.country ?? raw.marketplace ?? tld

  return { id, rating, title, body, date, verified, helpful, country }
}

export async function scrape(req: ScrapeRequest): Promise<Review[]> {
  const tld = req.marketplace.replace(/^amazon\./, '')

  // BrightData Amazon Reviews scraper needs the product page URL (/dp/ASIN), not /product-reviews/
  const productUrl = `https://www.amazon.${tld}/dp/${req.asin}/`

  console.log(`[Scraper] ${req.asin} fetching up to ${req.maxReviews} reviews via Dataset API`)
  console.log(`[Scraper] Product URL: ${productUrl}`)

  const res = await fetch(SCRAPE_ENDPOINT, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      input: [{ url: productUrl, max_reviews: req.maxReviews }],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`[Scraper] Dataset API error ${res.status}: ${text.slice(0, 300)}`)
    return []
  }

  const data = await res.json()
  console.log(`[Scraper] Raw response snippet: ${JSON.stringify(data).slice(0, 800)}`)
  if (Array.isArray(data) && data.length > 0) {
    console.log(`[Scraper] First row keys: ${Object.keys(data[0]).join(', ')}`)
    console.log(`[Scraper] First row full: ${JSON.stringify(data[0])}`)
  }

  const rows: BDReview[] = Array.isArray(data) ? data : (data?.reviews ?? [])
  console.log(`[Scraper] ${req.asin} → ${rows.length} raw rows from BrightData`)

  const reviews: Review[] = []
  const seenIds = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const review = mapReview(rows[i], req.asin, tld, i)
    if (review && !seenIds.has(review.id)) {
      seenIds.add(review.id)
      reviews.push(review)
    }
  }

  console.log(`[Scraper] ${req.asin} → ${reviews.length} mapped reviews`)
  return reviews.slice(0, req.maxReviews)
}
