import type { AmazonReview } from './amazon-types'

const RAILWAY_URL    = process.env.RAILWAY_SCRAPER_URL!   // e.g. https://voxrate-scraper.up.railway.app
const SCRAPER_SECRET = process.env.SCRAPER_SECRET!

const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS  = 240_000

interface RailwayReview {
  id: string
  rating: number
  title: string
  body: string
  date: string
  verified: boolean
  helpful: number
  country: string
}

interface JobResponse {
  jobId: string
  status: 'pending' | 'running' | 'done' | 'error'
  reviews?: RailwayReview[]
  error?: string
}

// Drop-in replacement for fetchFromBrightData. Same async trigger+poll pattern,
// but scraping is done by the Railway service through BrightData residential proxies.
export async function fetchFromRailway(
  url: string,
  maxReviews: number,
  asin: string,
  marketplace: string,
): Promise<AmazonReview[]> {
  if (!RAILWAY_URL) throw new Error('RAILWAY_SCRAPER_URL not set')

  const headers = {
    'Content-Type':    'application/json',
    'X-Scraper-Secret': SCRAPER_SECRET,
  }

  // Step 1 — trigger job
  const triggerRes = await fetch(`${RAILWAY_URL}/jobs`, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ url, asin, marketplace, maxReviews }),
    signal:  AbortSignal.timeout(15_000),
  })
  if (!triggerRes.ok) throw new Error(`Railway trigger HTTP ${triggerRes.status}`)
  const { jobId } = await triggerRes.json() as { jobId: string }
  console.log(`[Railway] Job ${jobId} triggered for ${asin}`)

  // Step 2 — poll until done
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

    const statusRes = await fetch(`${RAILWAY_URL}/jobs/${jobId}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    })
    if (!statusRes.ok) throw new Error(`Railway poll HTTP ${statusRes.status}`)

    const job = await statusRes.json() as JobResponse

    if (job.status === 'error') throw new Error(`Railway scrape error: ${job.error}`)

    if (job.status === 'done') {
      const reviews = (job.reviews ?? []).map((r): AmazonReview => ({
        id:       r.id,
        rating:   r.rating,
        title:    r.title,
        body:     r.body,
        date:     r.date,
        verified: r.verified,
        vine:     false,
        helpful:  r.helpful,
        country:  r.country,
      }))
      console.log(`[Railway] Job ${jobId} done — ${reviews.length} reviews for ${asin}`)
      return reviews
    }

    console.log(`[Railway] Job ${jobId} still ${job.status}...`)
  }

  throw new Error(`Railway job ${jobId} not done after ${POLL_TIMEOUT_MS / 1000}s`)
}
