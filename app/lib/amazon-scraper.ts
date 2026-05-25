import { createClient } from '@supabase/supabase-js'
import { AmazonScrapeResult, AmazonProduct, AmazonReview, AmazonQA } from './amazon-types'
import { fetchFromRailway } from './railway-scraper'
import crypto from 'crypto'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function writeReviewCache(asin: string, domain: string, reviews: AmazonReview[]): Promise<void> {
  try {
    const supabase = getAdminClient()
    await supabase.from('asin_review_cache').upsert(
      { asin, domain, reviews, cached_at: new Date().toISOString() },
      { onConflict: 'asin,domain' },
    )
    console.log(`[Cache] Wrote ${reviews.length} reviews for ${asin}/${domain}`)
  } catch (e: any) {
    console.warn('[Cache] Write failed:', e?.message)
  }
}

async function readReviewCache(asin: string, domain: string): Promise<AmazonReview[] | null> {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('asin_review_cache')
      .select('reviews, cached_at')
      .eq('asin', asin)
      .eq('domain', domain)
      .single()

    if (error || !data) return null

    const ageMs = Date.now() - new Date(data.cached_at).getTime()
    if (ageMs > CACHE_TTL_MS) {
      console.warn(`[Cache] Cache for ${asin}/${domain} is stale (${Math.round(ageMs / 3600000)}h old) — skipping`)
      return null
    }

    const reviews = data.reviews as AmazonReview[]
    console.warn(`[Cache] Serving ${reviews.length} cached reviews for ${asin}/${domain} (${Math.round(ageMs / 3600000)}h old)`)
    return reviews
  } catch (e: any) {
    console.warn('[Cache] Read failed:', e?.message)
    return null
  }
}

const SCRAPINGDOG_API_KEY  = process.env.SCRAPINGDOG_API_KEY!
const SCRAPERAPI_KEY       = process.env.SCRAPERAPI_KEY!
const BRIGHTDATA_API_KEY   = process.env.BRIGHTDATA_API_KEY
const BRIGHTDATA_DATASET   = 'gd_le8e811kzy4ggddlq'

// Canopy keys — auto-rotates to next key when current hits quota (429/403)
// Add CANOPY_API_KEY_2, _3, _4... in Vercel for more free-tier capacity
const CANOPY_KEYS = [
  process.env.CANOPY_API_KEY,
  process.env.CANOPY_API_KEY_2,
  process.env.CANOPY_API_KEY_3,
  process.env.CANOPY_API_KEY_4,
  process.env.CANOPY_API_KEY_5,
].filter(Boolean) as string[]

async function canopyFetch(url: string): Promise<Response> {
  let lastRes: Response | null = null
  for (let i = 0; i < CANOPY_KEYS.length; i++) {
    lastRes = await fetch(url, {
      headers: { 'API-KEY': CANOPY_KEYS[i], 'accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (lastRes.status !== 429 && lastRes.status !== 403) return lastRes
    console.warn(`[Scraper] Canopy key ${i + 1} quota hit (${lastRes.status}) — trying next key`)
  }
  // All keys exhausted — return last response (already a 429/403)
  return lastRes!
}

const SCRAPINGDOG_BASE = 'https://api.scrapingdog.com/amazon/product'
const CANOPY_BASE      = 'https://rest.canopyapi.co/api/amazon/product/reviews'
const SCRAPERAPI_BASE  = 'https://api.scraperapi.com/structured/amazon/product'

const REVIEWS_PER_PAGE = 10

const STAR_FILTER_MAP: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'ONE_STAR',
  2: 'TWO_STAR',
  3: 'THREE_STAR',
  4: 'FOUR_STAR',
  5: 'FIVE_STAR',
}

// Base pages per star tier. Each tier can absorb at most 1 extra page from rollover.
// Excess rollover (beyond 1) keeps flowing to the next tier.
// Max possible: 3+3+3+2+2 = 13 pages = ~130 reviews
const BASE_PAGES: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 3, 2: 3, 3: 1, 4: 1, 5: 3 }
const MAX_ROLLOVER_PER_TIER = 1

function allocatePages(ratingBreakdown: { one: number; two: number; three: number; four: number; five: number }): Record<1 | 2 | 3 | 4 | 5, number> {
  const counts: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: ratingBreakdown.one,
    2: ratingBreakdown.two,
    3: ratingBreakdown.three,
    4: ratingBreakdown.four,
    5: ratingBreakdown.five,
  }
  const pages: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const totalReviews = counts[1] + counts[2] + counts[3] + counts[4] + counts[5]
  let rollover = 0

  for (const star of [1, 2, 3, 4, 5] as const) {
    const usableRollover  = Math.min(MAX_ROLLOVER_PER_TIER, rollover)
    const passedRollover  = rollover - usableRollover           // excess keeps flowing
    const budget          = BASE_PAGES[star] + usableRollover
    const needed          = (counts[star] < 3 && totalReviews > 50) ? 0 : Math.ceil(counts[star] / REVIEWS_PER_PAGE)
    const alloc           = Math.min(budget, needed)
    pages[star]           = alloc
    rollover              = passedRollover + (budget - alloc)   // unused base + passed excess
  }

  return pages
}

const DOMAIN_MAP: Record<string, string> = {
  'amazon.com':    'US',
  'amazon.co.uk':  'UK',
  'amazon.ca':     'CA',
  'amazon.de':     'DE',
  'amazon.fr':     'FR',
  'amazon.it':     'IT',
  'amazon.es':     'ES',
  'amazon.com.au': 'AU',
  'amazon.co.jp':  'JP',
  'amazon.in':     'IN',
  'amazon.com.mx': 'MX',
  'amazon.com.br': 'BR',
  'amazon.pl':     'PL',
}

// ── Chrome Extension scraper ──────────────────────────────────────
// Creates a job in extension_jobs, waits up to 60s for the extension to
// complete it, then returns the reviews. Returns null if no extension is
// connected or if it times out.

async function fetchFromExtension(
  asin: string,
  marketplace: string,
  maxReviews: number,
  userId: string,
): Promise<AmazonReview[] | null> {
  const supabase = getAdminClient()

  // Check if user has an active extension session (heartbeat within 30s)
  const recentThreshold = new Date(Date.now() - 30_000).toISOString()
  const { data: session } = await supabase
    .from('extension_sessions')
    .select('user_id')
    .eq('user_id', userId)
    .gte('last_seen_at', recentThreshold)
    .single()

  if (!session) {
    console.log('[Extension] No active extension session for user — skipping')
    return null
  }

  // Create a pending job
  const jobId = crypto.randomUUID()
  const { error: insertErr } = await supabase
    .from('extension_jobs')
    .insert({
      id: jobId,
      user_id: userId,
      asin,
      marketplace,
      max_reviews: maxReviews,
      status: 'pending',
      created_at: new Date().toISOString(),
    })

  if (insertErr) {
    console.warn('[Extension] Failed to create job:', insertErr.message)
    return null
  }

  console.log(`[Extension] Job ${jobId} created for ${asin} — waiting for extension`)

  // Poll for result every 2s, timeout after 60s
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000))

    const { data: job } = await supabase
      .from('extension_jobs')
      .select('status, reviews, error')
      .eq('id', jobId)
      .single()

    if (!job) break

    if (job.status === 'completed' || job.status === 'partial') {
      const reviews = (job.reviews as AmazonReview[]) ?? []
      console.log(`[Extension] Job ${jobId} done: ${reviews.length} reviews`)
      return reviews
    }

    if (job.status === 'amazon_not_logged_in') {
      console.warn('[Extension] Amazon login wall — user needs to log in')
      throw new Error('amazon_not_logged_in')
    }

    if (job.status === 'failed') {
      console.warn('[Extension] Job failed:', job.error)
      return null
    }
  }

  // Timeout — mark job failed so it doesn't linger
  await supabase
    .from('extension_jobs')
    .update({ status: 'failed', error: 'Timed out waiting for extension' })
    .eq('id', jobId)

  console.warn('[Extension] Job timed out after 60s — falling back')
  return null
}

export async function scrapeAmazon(input: string, plan = 'starter', userId?: string): Promise<AmazonScrapeResult> {
  const { asin, marketplace } = parseInput(input)
  console.log(`[Scraper] ASIN: ${asin} | Marketplace: ${marketplace}`)

  const domain = DOMAIN_MAP[marketplace] ?? 'US'

  // Cache-first: return immediately if fresh cache exists (< 7 days)
  const cachedEarly = await readReviewCache(asin, domain)
  if (cachedEarly && cachedEarly.length > 0) {
    console.log(`[Cache] HIT for ${asin}/${domain} — skipping scrape`)
    console.log(`[Scraper] Cache hit for ${asin}/${domain} — skipping Canopy`)
    const [{ product: productData }, qaData] = await Promise.all([
      fetchProduct(asin, marketplace),
      fetchQA(asin, marketplace),
    ])
    const bystar = [1, 2, 3, 4, 5].map(s => cachedEarly.filter(r => r.rating === s).length)
    console.log(
      `[Scraper] "${productData.title.slice(0, 50)}" | ` +
      `${productData.totalReviews} total ratings | ` +
      `${cachedEarly.length} texts (1★:${bystar[0]} 2★:${bystar[1]} 3★:${bystar[2]} 4★:${bystar[3]} 5★:${bystar[4]}) | ` +
      `${qaData.length} Q&A [FROM CACHE]`
    )
    return {
      product:          productData,
      reviews:          cachedEarly,
      qa:               qaData,
      scrapedAt:        new Date().toISOString(),
      marketplace,
      fromCache:        true,
      scraperProvider:  'cache',
      scraperPages:     0,
    }
  }

  console.log(`[Cache] MISS for ${asin}/${domain} — scraping fresh`)
  // Fetch product first so we know the rating breakdown, then allocate pages smartly
  const [{ product: productData }, qaData] = await Promise.all([
    fetchProduct(asin, marketplace),
    fetchQA(asin, marketplace),
  ])

  let allReviews: AmazonReview[] = []
  let scraperProvider = 'canopy'
  let totalAllocatedPages = 0

  const maxReviews = brightDataMaxReviews(productData.ratingBreakdown, productData.totalReviews, plan)
  const tld        = marketplace.replace('amazon.', '')

  // Primary: Chrome Extension (user's own logged-in browser — bypasses all Amazon blocks)
  if (userId) {
    try {
      const extReviews = await fetchFromExtension(asin, marketplace, maxReviews, userId)
      if (extReviews && extReviews.length > 0) {
        allReviews      = rebalanceReviews(extReviews, productData.ratingBreakdown)
        scraperProvider = 'extension'
        console.log(`[Scraper] Extension succeeded with ${allReviews.length} reviews`)
      }
    } catch (err: any) {
      if (err.message === 'amazon_not_logged_in') throw err // propagate — frontend should show login prompt
      console.warn(`[Scraper] Extension failed: ${err.message}`)
    }
  }

  // Secondary: Railway scraper (direct HTML pagination via BrightData residential proxies)
  if (allReviews.length === 0 && process.env.RAILWAY_SCRAPER_URL) {
    try {
      const reviewUrl = `https://www.amazon.${tld}/product-reviews/${asin}?reviewerType=all_reviews&sortBy=recent`
      const raw       = await fetchFromRailway(reviewUrl, maxReviews, asin, marketplace)
      const valid     = filterReviews(raw, 'railway')
      if (valid.length > 0) {
        allReviews      = rebalanceReviews(valid, productData.ratingBreakdown)
        scraperProvider = 'railway'
        console.log(`[Scraper] Railway succeeded with ${allReviews.length} reviews`)
      } else {
        console.warn('[Scraper] Railway returned 0 valid reviews — falling back to BrightData dataset')
      }
    } catch (err: any) {
      console.warn(`[Scraper] Railway failed: ${err.message} — falling back to BrightData dataset`)
    }
  }

  // Fallback: BrightData dataset API (slower, fewer reviews, but independent of Railway)
  if (allReviews.length === 0 && BRIGHTDATA_API_KEY) {
    try {
      const dpUrl = `https://www.amazon.${tld}/dp/${asin}`
      const raw   = await fetchFromBrightData(dpUrl, maxReviews, asin)
      const valid = filterReviews(raw, 'brightdata')
      if (valid.length > 0) {
        allReviews      = rebalanceReviews(valid, productData.ratingBreakdown)
        scraperProvider = 'brightdata'
        console.log(`[Scraper] BrightData fallback succeeded with ${allReviews.length} reviews`)
      } else {
        console.warn('[Scraper] BrightData fallback returned 0 valid reviews')
      }
    } catch (err: any) {
      console.warn(`[Scraper] BrightData fallback failed: ${err.message}`)
    }
  }

  // Final fallback: Canopy API (free, star-filtered, up to ~130 reviews)
  if (allReviews.length === 0 && CANOPY_KEYS.length > 0) {
    try {
      const pageAlloc = allocatePages(productData.ratingBreakdown)
      totalAllocatedPages = Object.values(pageAlloc).reduce((a, b) => a + b, 0)
      const raw   = await fetchAllReviews(asin, domain, pageAlloc)
      const valid = filterReviews(raw, 'canopy')
      if (valid.length > 0) {
        allReviews      = valid
        scraperProvider = 'canopy'
        console.log(`[Scraper] Canopy fallback succeeded with ${allReviews.length} reviews (${totalAllocatedPages} pages)`)
      } else {
        console.warn('[Scraper] Canopy fallback returned 0 valid reviews')
      }
    } catch (err: any) {
      console.warn(`[Scraper] Canopy fallback failed: ${err.message}`)
    }
  }

  const fromCache = false

  if (allReviews.length > 0) {
    writeReviewCache(asin, domain, allReviews).catch(() => {})
  }

  const bystar = [1, 2, 3, 4, 5].map(s => allReviews.filter(r => r.rating === s).length)

  console.log(
    `[Scraper] "${productData.title.slice(0, 50)}" | ` +
    `${productData.totalReviews} total ratings | ` +
    `${allReviews.length} reviews (1★:${bystar[0]} 2★:${bystar[1]} 3★:${bystar[2]} 4★:${bystar[3]} 5★:${bystar[4]}) | ` +
    `${qaData.length} Q&A`
  )

  return {
    product:          productData,
    reviews:          allReviews,
    qa:               qaData,
    scrapedAt:        new Date().toISOString(),
    marketplace,
    fromCache,
    scraperProvider:  scraperProvider,
    scraperPages:     totalAllocatedPages,
  }
}

// Free-plan scrape — 1★ reviews via Canopy (shows real complaints), Bright Data fallback
export async function scrapeAmazonFree(input: string): Promise<AmazonScrapeResult> {
  const { asin, marketplace } = parseInput(input)
  console.log(`[Scraper:free] ASIN: ${asin} | Marketplace: ${marketplace}`)

  const domain = DOMAIN_MAP[marketplace] ?? 'US'

  const { product: productData } = await fetchProduct(asin, marketplace)

  // Cache-first: 1★ reviews cached for 2 days for free users
  const cachedFree = await readReviewCache(asin, domain)
  if (cachedFree && cachedFree.length > 0) {
    const oneStarCached = cachedFree.filter(r => r.rating === 1).slice(0, 10)
    if (oneStarCached.length > 0) {
      console.log(`[Scraper:free] Cache hit for ${asin}/${domain} — serving ${oneStarCached.length} 1★ reviews`)
      return {
        product: productData,
        reviews: oneStarCached,
        qa: [],
        scrapedAt: new Date().toISOString(),
        marketplace,
        fromCache: true,
        scraperProvider: 'cache',
        scraperPages: 0,
      }
    }
  }

  // Fetch 1★ reviews — user sees real complaints, feels the tool's value, wants to upgrade
  let reviews = await fetchOnePageFiltered(asin, domain, 'ONE_STAR')
  let scraperProvider = 'canopy'

  // Fallback 1: Railway scraper
  if (reviews.length === 0 && process.env.RAILWAY_SCRAPER_URL) {
    try {
      const tld       = marketplace.replace('amazon.', '')
      const reviewUrl = `https://www.amazon.${tld}/product-reviews/${asin}?filterByStar=critical&reviewerType=all_reviews&sortBy=recent`
      const all       = await fetchFromRailway(reviewUrl, 20, asin, marketplace)
      reviews         = all.filter(r => r.rating <= 2).slice(0, 10)
      if (reviews.length === 0) reviews = all.slice(0, 10)
      scraperProvider = 'railway'
    } catch (err: any) {
      console.warn(`[Scraper:free] Railway fallback failed: ${err.message}`)
    }
  }

  // Fallback 2: BrightData dataset
  if (reviews.length === 0 && BRIGHTDATA_API_KEY) {
    try {
      const all = await fetchFromBrightData(`https://www.amazon.${marketplace.replace('amazon.', '')}/dp/${asin}`, 20, asin)
      reviews   = all.filter(r => r.rating <= 2).slice(0, 10)
      if (reviews.length === 0) reviews = all.slice(0, 10)
      scraperProvider = 'brightdata'
    } catch (err: any) {
      console.warn(`[Scraper:free] BrightData fallback failed: ${err.message}`)
    }
  }

  console.log(`[Scraper:free] "${productData.title.slice(0, 50)}" | ${reviews.length} reviews (1★ filtered) [${scraperProvider}]`)

  if (reviews.length > 0) {
    writeReviewCache(asin, domain, reviews).catch(() => {})
  }

  return {
    product:         productData,
    reviews,
    qa:              [],
    scrapedAt:       new Date().toISOString(),
    marketplace,
    fromCache:       false,
    scraperProvider,
    scraperPages:    1,
  }
}

async function fetchOnePageFiltered(asin: string, domain: string, rating: string): Promise<AmazonReview[]> {
  try {
    const url = `${CANOPY_BASE}?asin=${asin}&domain=${domain}&page=1&rating=${rating}&verified_purchases_only=true&sort_by=RECENT`
    const res = await canopyFetch(url)
    if (!res.ok) {
      console.warn(`[Scraper:free] Canopy filtered page HTTP ${res.status}`)
      return []
    }
    const data     = await res.json()
    const paginated = data?.data?.amazonProduct?.reviewsPaginated
    if (!paginated) return []
    return (paginated.reviews ?? []).map((r: CanopyReview, i: number) => ({
      id:       r.id ?? `${asin}-free-${i}`,
      rating:   r.rating ?? 1,
      title:    r.title ?? '',
      body:     r.body ?? '',
      date:     '',
      verified: r.verifiedPurchase ?? false,
      vine:     false,
      helpful:  r.helpfulVotes ?? 0,
      country:  domain.toLowerCase(),
    }))
  } catch (e) {
    console.warn('[Scraper:free] fetchOnePageFiltered exception:', e)
    return []
  }
}

// Per-plan review caps — keeps scraping cost under 30% of plan revenue.
// Pro: 150 reviews = $0.225 max. Starter/Growth: 120 = $0.18 max.
function brightDataMaxReviews(
  _breakdown: { one: number; two: number; three: number; four: number; five: number },
  totalReviews: number,
  plan: string,
): number {
  const cap = plan === 'pro' ? 150 : 120
  return Math.min(totalReviews, cap)
}

// Rebalance Bright Data's flat review list to mirror Canopy's star-weighted approach.
// Target: 1★ 30%, 2★ 20%, 3★ 10%, 4★ 10%, 5★ 30% — heavily negative-weighted.
// Falls back gracefully if a star tier has fewer reviews than the target.
function rebalanceReviews(
  reviews: AmazonReview[],
  breakdown: { one: number; two: number; three: number; four: number; five: number },
): AmazonReview[] {
  const bystar: Record<number, AmazonReview[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  for (const r of reviews) {
    const s = r.rating >= 1 && r.rating <= 5 ? r.rating : 0
    if (s > 0) bystar[s].push(r)
  }

  const total = reviews.length || 1
  // Too few reviews to rebalance — just send everything
  if (total < 20) return reviews

  // Weight toward negative: 1★ and 2★ get priority
  const targets: Record<number, number> = {
    1: Math.round(total * 0.30),
    2: Math.round(total * 0.20),
    3: Math.round(total * 0.10),
    4: Math.round(total * 0.10),
    5: Math.round(total * 0.30),
  }

  // If a product has very few negative reviews (high-rated), respect that
  const totalNeg = breakdown.one + breakdown.two
  const totalAll = breakdown.one + breakdown.two + breakdown.three + breakdown.four + breakdown.five
  if (totalAll > 0 && totalNeg / totalAll < 0.05) {
    // < 5% negative — don't over-weight negatives, use natural distribution
    return reviews
  }

  const result: AmazonReview[] = []
  for (const star of [1, 2, 3, 4, 5] as const) {
    result.push(...bystar[star].slice(0, targets[star]))
  }

  // Fill remaining slots with whatever is left (sorted by helpfulness)
  const used = new Set(result.map(r => r.id))
  const leftover = reviews.filter(r => !used.has(r.id)).sort((a, b) => b.helpful - a.helpful)
  result.push(...leftover.slice(0, total - result.length))

  console.log(`[BrightData] Rebalanced: 1★${bystar[1].length}→${Math.min(bystar[1].length, targets[1])} 2★${bystar[2].length}→${Math.min(bystar[2].length, targets[2])} 3★${bystar[3].length}→${Math.min(bystar[3].length, targets[3])} 4★${bystar[4].length}→${Math.min(bystar[4].length, targets[4])} 5★${bystar[5].length}→${Math.min(bystar[5].length, targets[5])}`)
  return result
}


// ── BrightData dataset fetcher (fallback) ────────────────────
// Used only when Railway scraper is unavailable or returns 0 reviews.
// Known limitations: returns fewer reviews than actual count, rating field
// unreliable (87% return 0 — defaulted to 3★), no star filtering support.

async function fetchFromBrightData(url: string, maxReviews: number, asin: string): Promise<AmazonReview[]> {
  const triggerRes = await fetch(
    `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${BRIGHTDATA_DATASET}&include_errors=true`,
    {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify([{ url, max_reviews: maxReviews }]),
      signal:  AbortSignal.timeout(15_000),
    }
  )
  if (!triggerRes.ok) throw new Error(`BrightData trigger HTTP ${triggerRes.status}`)
  const { snapshot_id } = await triggerRes.json() as { snapshot_id: string }
  console.log(`[BrightData] triggered snapshot ${snapshot_id} for ${asin}`)

  const deadline = Date.now() + 240_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5_000))
    const statusRes = await fetch(
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}?format=ndjson`,
      { headers: { 'Authorization': `Bearer ${BRIGHTDATA_API_KEY}` }, signal: AbortSignal.timeout(10_000) }
    )
    if (statusRes.status === 202) continue
    if (!statusRes.ok) throw new Error(`BrightData snapshot HTTP ${statusRes.status}`)

    const lines = (await statusRes.text()).trim().split('\n').filter(Boolean)
    const reviews: AmazonReview[] = []
    for (let i = 0; i < lines.length; i++) {
      try {
        const r = JSON.parse(lines[i])
        if (r.error || !r.review_text) continue
        const raw    = r.rating ?? r.review_rating ?? r.star_rating ?? 0
        const rating = raw >= 1 && raw <= 5 ? Math.round(raw) : 3
        reviews.push({
          id:       r.review_id ?? `bd-${asin}-${i}`,
          rating,
          title:    r.title ?? '',
          body:     r.review_text,
          date:     r.review_posted_date ?? '',
          verified: r.is_verified ?? r.badge === 'Verified Purchase',
          vine:     r.is_amazon_vine ?? false,
          helpful:  r.helpful_count ?? 0,
          country:  url.match(/amazon\.(\S+?)\//)?.[1] ?? 'com',
        })
      } catch { /* skip malformed */ }
    }
    console.log(`[BrightData] ${reviews.length} reviews for ${asin}`)
    return reviews
  }
  throw new Error(`BrightData snapshot not ready after 240s`)
}

// ── Review validation ─────────────────────────────────────────

function isValidReview(r: AmazonReview): boolean {
  if (r.rating < 1 || r.rating > 5) return false
  if (!r.body || r.body.trim().length < 20) return false
  return true
}

function filterReviews(reviews: AmazonReview[], label: string): AmazonReview[] {
  const before = reviews.length
  const filtered = reviews.filter(isValidReview)
  if (filtered.length < before) {
    console.log(`[Scraper] Filtered ${before - filtered.length} invalid reviews${label ? ` (${label})` : ''}`)
  }
  return filtered
}

// Fetch all 5 star tiers in parallel using pre-allocated page counts
async function fetchAllReviews(asin: string, domain: string, pageAlloc: Record<1 | 2 | 3 | 4 | 5, number>): Promise<AmazonReview[]> {
  const batches = await Promise.all(
    ([1, 2, 3, 4, 5] as const).map(star => fetchStarReviews(asin, domain, star, pageAlloc[star]))
  )
  const flat = batches.flat()

  // Deduplicate by ID (keep first occurrence)
  const seenIds = new Set<string>()
  const seenBodies = new Set<string>()
  const deduped: AmazonReview[] = []
  for (const review of flat) {
    const bodyKey = review.body.trim().toLowerCase()
    if (seenIds.has(review.id) || seenBodies.has(bodyKey)) continue
    seenIds.add(review.id)
    if (bodyKey) seenBodies.add(bodyKey)
    deduped.push(review)
  }
  if (deduped.length < flat.length) {
    console.log(`[Scraper] Deduplication removed ${flat.length - deduped.length} duplicate reviews`)
  }
  return deduped
}

async function fetchStarReviews(
  asin: string,
  domain: string,
  star: 1 | 2 | 3 | 4 | 5,
  maxPages: number,
): Promise<AmazonReview[]> {
  const reviews: AmazonReview[] = []
  const rating = STAR_FILTER_MAP[star]

  if (maxPages === 0) return reviews

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = `${CANOPY_BASE}?asin=${asin}&domain=${domain}&page=${page}&rating=${rating}&verified_purchases_only=true&sort_by=RECENT`
      const res = await canopyFetch(url)

      if (!res.ok) {
        console.warn(`[Scraper] Canopy ${star}★ page ${page} HTTP ${res.status}`)
        break
      }

      const data = await res.json()
      const paginated = data?.data?.amazonProduct?.reviewsPaginated
      if (!paginated) break

      const batch: AmazonReview[] = (paginated.reviews ?? []).map((r: CanopyReview, i: number) => ({
        id: r.id ?? `${asin}-${star}-${page}-${i}`,
        rating: r.rating ?? star,
        title: r.title ?? '',
        body: r.body ?? '',
        date: '',
        verified: r.verifiedPurchase ?? false,
        vine: false,
        helpful: r.helpfulVotes ?? 0,
        country: domain.toLowerCase(),
      }))

      reviews.push(...batch)

      if (!paginated.pageInfo?.hasNextPage) break
    } catch (e) {
      console.warn(`[Scraper] Canopy ${star}★ page ${page} exception:`, e)
      break
    }
  }

  console.log(`[Scraper] ${star}★ — ${reviews.length} reviews`)
  return reviews
}

interface CanopyReview {
  id?: string | null
  title?: string
  body?: string
  rating?: number
  helpfulVotes?: number | null
  verifiedPurchase?: boolean
}

function parseInput(input: string): { asin: string; marketplace: string } {
  input = input.trim()

  if (/^[A-Z0-9]{10}$/i.test(input)) {
    return { asin: input.toUpperCase(), marketplace: 'amazon.com' }
  }

  try {
    const url = new URL(input)
    const host = url.hostname.toLowerCase()
    const marketplace = host.replace('www.', '')
    const asinMatch = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
    if (!asinMatch) throw new Error('Could not extract ASIN from URL')
    return { asin: asinMatch[1].toUpperCase(), marketplace }
  } catch {
    throw new Error('Invalid input: provide an Amazon URL or ASIN (e.g. B073JYC4XM)')
  }
}

// Marketplace → Scrapingdog country/domain params
function toScrapingdogParams(marketplace: string): { country: string; domain: string } {
  const map: Record<string, { country: string; domain: string }> = {
    'amazon.com':    { country: 'us',  domain: 'com'    },
    'amazon.co.uk':  { country: 'uk',  domain: 'co.uk'  },
    'amazon.de':     { country: 'de',  domain: 'de'     },
    'amazon.fr':     { country: 'fr',  domain: 'fr'     },
    'amazon.it':     { country: 'it',  domain: 'it'     },
    'amazon.es':     { country: 'es',  domain: 'es'     },
    'amazon.ca':     { country: 'ca',  domain: 'ca'     },
    'amazon.com.au': { country: 'au',  domain: 'com.au' },
    'amazon.co.jp':  { country: 'jp',  domain: 'co.jp'  },
    'amazon.in':     { country: 'in',  domain: 'in'     },
    'amazon.com.mx': { country: 'mx',  domain: 'com.mx' },
    'amazon.com.br': { country: 'br',  domain: 'com.br' },
  }
  return map[marketplace] ?? { country: 'us', domain: 'com' }
}

async function fetchProduct(asin: string, marketplace: string): Promise<{ product: AmazonProduct }> {
  try {
    return await fetchProductScrapingDog(asin, marketplace)
  } catch (err: any) {
    console.warn(`[Scraper] ScrapingDog failed (${err.message}) — falling back to ScraperAPI`)
    return await fetchProductScraperAPI(asin, marketplace)
  }
}

async function fetchProductScrapingDog(asin: string, marketplace: string): Promise<{ product: AmazonProduct }> {
  const { country, domain } = toScrapingdogParams(marketplace)
  const params = new URLSearchParams({ api_key: SCRAPINGDOG_API_KEY, asin, country, domain })

  const res = await fetch(`${SCRAPINGDOG_BASE}?${params}`, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`ScrapingDog ${res.status}`)

  const p = await res.json()
  console.log(`[Scraper][ScrapingDog] "${String(p?.title ?? '').slice(0, 60)}"`)

  const totalReviews = parseInt(String(p?.total_reviews ?? '0').replace(/\D/g, '')) || 0
  const dist: Array<{ rating: number; distribution: string }> = p?.ratings_distribution ?? []
  const pct = (star: number) => {
    const entry = dist.find(d => d.rating === star)
    return entry ? Math.round(totalReviews * (parseFloat(entry.distribution) / 100)) : 0
  }
  const ratingBreakdown = { five: pct(5), four: pct(4), three: pct(3), two: pct(2), one: pct(1) }

  const bsrRaw: string = p?.product_information?.['Best Sellers Rank'] ?? ''
  const bsrMatch = bsrRaw.match(/#([\d,]+)\s+in\s+([^(#\n]+)/)
  const bsr = bsrMatch ? parseInt(bsrMatch[1].replace(/,/g, '')) : null
  const bsrCategory = bsrMatch ? bsrMatch[2].trim() : null

  const priceMatch = String(p?.price ?? '').match(/\$([\d.]+)/)
  const price = priceMatch ? parseFloat(priceMatch[1]) : null

  return {
    product: {
      asin,
      marketplace,
      title:          p?.title ?? '',
      brand:          p?.product_information?.['Brand Name'] ?? '',
      mainImage:      p?.main_image ?? '',
      images:         p?.images ?? [],
      imageCount:     (p?.images ?? []).length,
      videoCount:     p?.number_of_videos ?? 0,
      hasAplus:       p?.aplus ?? false,
      bulletPoints:   p?.feature_bullets ?? [],
      description:    '',
      bsr,
      bsrCategory,
      price,
      currency:       'USD',
      category:       p?.product_category ?? '',
      categoriesFlat: p?.product_category ?? '',
      averageRating:  parseFloat(p?.average_rating ?? '0') || 0,
      totalReviews,
      ratingBreakdown,
      specifications: [],
      recentSales:    p?.number_of_people_bought ?? null,
      isFBA:          String(p?.ships_from ?? '').toLowerCase().includes('amazon'),
    },
  }
}

async function fetchProductScraperAPI(asin: string, marketplace: string): Promise<{ product: AmazonProduct }> {
  const scraperApiCountryMap: Record<string, string> = {
    'amazon.com':    'us',
    'amazon.co.uk':  'uk',
    'amazon.de':     'de',
    'amazon.fr':     'fr',
    'amazon.it':     'it',
    'amazon.es':     'es',
    'amazon.ca':     'ca',
    'amazon.com.au': 'au',
    'amazon.co.jp':  'jp',
    'amazon.in':     'in',
    'amazon.com.mx': 'mx',
    'amazon.com.br': 'br',
  }
  const country = scraperApiCountryMap[marketplace] ?? 'us'
  const params  = new URLSearchParams({ api_key: SCRAPERAPI_KEY, asin, country })

  const res = await fetch(`${SCRAPERAPI_BASE}?${params}`, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`ScraperAPI ${res.status}`)

  const p = await res.json()
  console.log(`[Scraper][ScraperAPI] "${String(p?.name ?? '').slice(0, 60)}"`)

  const totalReviews = parseInt(String(p?.total_reviews ?? p?.total_ratings ?? '0').replace(/\D/g, '')) || 0

  // ScraperAPI gives star percentages directly (e.g. 43 for 43%)
  const starPct = (key: string) => Math.round(totalReviews * ((p?.[key] ?? 0) / 100))
  const ratingBreakdown = {
    five:  starPct('5_star_percentage'),
    four:  starPct('4_star_percentage'),
    three: starPct('3_star_percentage'),
    two:   starPct('2_star_percentage'),
    one:   starPct('1_star_percentage'),
  }

  // BSR: array of strings like ["#39,833 in Health & Household", "#57 in Digital Bathroom Scales"]
  const bsrArr: string[] = p?.product_information?.best_sellers_rank ?? []
  const bsrFirst = bsrArr[0] ?? ''
  const bsrMatch = bsrFirst.match(/#([\d,]+)\s+in\s+(.+)/)
  const bsr         = bsrMatch ? parseInt(bsrMatch[1].replace(/,/g, '')) : null
  const bsrCategory = bsrMatch ? bsrMatch[2].trim() : null

  const priceMatch = String(p?.pricing ?? '').match(/\$([\d.]+)/)
  const price = priceMatch ? parseFloat(priceMatch[1]) : null

  const images = p?.high_res_images ?? p?.images ?? []

  return {
    product: {
      asin,
      marketplace,
      title:          p?.name ?? '',
      brand:          p?.product_information?.brand_name ?? '',
      mainImage:      images[0] ?? '',
      images,
      imageCount:     images.length,
      videoCount:     0,
      hasAplus:       p?.aplus_present ?? false,
      bulletPoints:   p?.feature_bullets ?? [],
      description:    p?.full_description ?? '',
      bsr,
      bsrCategory,
      price,
      currency:       'USD',
      category:       p?.product_category ?? '',
      categoriesFlat: p?.product_category ?? '',
      averageRating:  parseFloat(p?.average_rating ?? '0') || 0,
      totalReviews,
      ratingBreakdown,
      specifications: [],
      recentSales:    null,
      isFBA:          String(p?.sold_by ?? '').toLowerCase().includes('amazon'),
    },
  }
}

// Q&A not available via Scrapingdog — return empty
async function fetchQA(_asin: string, _marketplace: string): Promise<AmazonQA[]> {
  return []
}

