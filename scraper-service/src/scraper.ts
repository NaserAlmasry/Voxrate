import type { ScrapeRequest, Review } from './types.js'

const BRIGHTDATA_API_KEY  = process.env.BRIGHTDATA_API_KEY!
const DATASET_ID          = 'gd_le8e811kzy4ggddlq'
const SCRAPE_ENDPOINT     = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${DATASET_ID}&format=json`

const MAX_PAGES = 10

// BrightData Amazon Reviews scraper raw row shape (fields may vary — we guard every access)
interface BDReview {
  review_id?:        string
  id?:               string
  rating?:           number | string
  star_rating?:      number | string
  title?:            string
  review_title?:     string
  body?:             string
  review_body?:      string
  content?:          string
  date?:             string
  review_date?:      string
  verified_purchase?: boolean | string
  verified?:         boolean | string
  helpful_votes?:    number | string
  helpful?:          number | string
  country?:          string
  marketplace?:      string
  asin?:             string
}

function mapReview(raw: BDReview, asin: string, tld: string, index: number): Review | null {
  const id     = raw.review_id ?? raw.id ?? `bd-${asin}-${Date.now()}-${index}`
  const rating = Math.round(parseFloat(String(raw.rating ?? raw.star_rating ?? 0)))
  if (rating < 1 || rating > 5) return null

  const title  = raw.title ?? raw.review_title ?? ''
  const body   = raw.body  ?? raw.review_body  ?? raw.content ?? ''
  if (body.length < 20) return null

  const date     = raw.date ?? raw.review_date ?? ''
  const verified = Boolean(raw.verified_purchase ?? raw.verified ?? false)
  const helpful  = parseInt(String(raw.helpful_votes ?? raw.helpful ?? 0)) || 0
  const country  = raw.country ?? raw.marketplace ?? tld

  return { id, rating, title, body, date, verified, helpful, country }
}

async function fetchPageViaDataset(url: string): Promise<BDReview[]> {
  const res = await fetch(SCRAPE_ENDPOINT, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify([{ url }]),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`[Scraper] Dataset API error ${res.status}: ${text.slice(0, 300)}`)
    return []
  }

  const data = await res.json()
  console.log(`[Scraper] Raw response snippet: ${JSON.stringify(data).slice(0, 500)}`)

  // Response is either an array of reviews or an object with an error
  if (Array.isArray(data)) return data as BDReview[]
  if (data?.reviews && Array.isArray(data.reviews)) return data.reviews as BDReview[]
  return []
}

export async function scrape(req: ScrapeRequest): Promise<Review[]> {
  const tld        = req.marketplace.replace(/^amazon\./, '')
  const allReviews: Review[] = []
  const seenIds    = new Set<string>()

  const base = new URL(req.url)
  base.searchParams.delete('pageNumber')
  base.searchParams.set('reviewerType', 'all_reviews')
  base.searchParams.set('ie', 'UTF8')

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (allReviews.length >= req.maxReviews) break

    base.searchParams.set('pageNumber', String(page))
    const pageUrl = base.toString()
    console.log(`[Scraper] ${req.asin} fetching page ${page} via Dataset API`)

    const batch = await fetchPageViaDataset(pageUrl)

    if (batch.length === 0) {
      console.log(`[Scraper] Empty batch on page ${page} — stopping`)
      break
    }

    let added = 0
    for (let i = 0; i < batch.length; i++) {
      const review = mapReview(batch[i], req.asin, tld, i)
      if (review && !seenIds.has(review.id)) {
        seenIds.add(review.id)
        allReviews.push(review)
        added++
      }
    }

    console.log(`[Scraper] ${req.asin} page ${page} → ${batch.length} raw, ${added} mapped (total: ${allReviews.length}/${req.maxReviews})`)
  }

  return allReviews.slice(0, req.maxReviews)
}
