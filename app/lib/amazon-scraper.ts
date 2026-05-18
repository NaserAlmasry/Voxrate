import { AmazonScrapeResult, AmazonProduct, AmazonReview, AmazonQA } from './amazon-types'

const SCRAPINGDOG_API_KEY  = process.env.SCRAPINGDOG_API_KEY!
const SCRAPERAPI_KEY       = process.env.SCRAPERAPI_KEY!

// Two Canopy keys — auto-rotates to backup when primary returns 429/quota error
const CANOPY_KEYS = [
  process.env.CANOPY_API_KEY,
  process.env.CANOPY_API_KEY_2,
].filter(Boolean) as string[]

async function canopyFetch(url: string): Promise<Response> {
  for (let i = 0; i < CANOPY_KEYS.length; i++) {
    const res = await fetch(url, {
      headers: { 'API-KEY': CANOPY_KEYS[i], 'accept': 'application/json' },
    })
    if (res.status !== 429 && res.status !== 403) return res
    console.warn(`[Scraper] Canopy key ${i + 1} quota hit (${res.status}) — trying next key`)
  }
  // All keys exhausted — return last response
  return fetch(url, {
    headers: { 'API-KEY': CANOPY_KEYS[CANOPY_KEYS.length - 1], 'accept': 'application/json' },
  })
}
const SCRAPINGDOG_BASE    = 'https://api.scrapingdog.com/amazon/product'
const CANOPY_BASE         = 'https://rest.canopyapi.co/api/amazon/product/reviews'
const SCRAPERAPI_BASE     = 'https://api.scraperapi.com/structured/amazon/product'

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
// Max possible: 3+3+2+2+2 = 12 pages = ~120 reviews
const BASE_PAGES: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 3, 2: 2, 3: 1, 4: 1, 5: 1 }
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
    const needed          = (counts[star] < 5 && totalReviews > 100) ? 0 : Math.ceil(counts[star] / REVIEWS_PER_PAGE)
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

export async function scrapeAmazon(input: string): Promise<AmazonScrapeResult> {
  const { asin, marketplace } = parseInput(input)
  console.log(`[Scraper] ASIN: ${asin} | Marketplace: ${marketplace}`)

  const domain = DOMAIN_MAP[marketplace] ?? 'US'



  // Fetch product first so we know the rating breakdown, then allocate pages smartly
  const [{ product: productData }, qaData] = await Promise.all([
    fetchProduct(asin, marketplace),
    fetchQA(asin, marketplace),
  ])

  const pageAlloc = allocatePages(productData.ratingBreakdown)
  console.log(`[Scraper] Page budget: 1★×${pageAlloc[1]} 2★×${pageAlloc[2]} 3★×${pageAlloc[3]} 4★×${pageAlloc[4]} 5★×${pageAlloc[5]}`)
  const allReviews = await fetchAllReviews(asin, domain, pageAlloc)

  const bystar = [1, 2, 3, 4, 5].map(s => allReviews.filter(r => r.rating === s).length)

  console.log(
    `[Scraper] "${productData.title.slice(0, 50)}" | ` +
    `${productData.totalReviews} total ratings | ` +
    `${allReviews.length} texts (1★:${bystar[0]} 2★:${bystar[1]} 3★:${bystar[2]} 4★:${bystar[3]} 5★:${bystar[4]}) | ` +
    `${qaData.length} Q&A`
  )

  return {
    product: productData,
    reviews: allReviews,
    qa: qaData,
    scrapedAt: new Date().toISOString(),
    marketplace,
  }
}

// Free-plan scrape — 1 Canopy request only (unfiltered page 1)
export async function scrapeAmazonFree(input: string): Promise<AmazonScrapeResult> {
  const { asin, marketplace } = parseInput(input)
  console.log(`[Scraper:free] ASIN: ${asin} | Marketplace: ${marketplace}`)

  const domain = DOMAIN_MAP[marketplace] ?? 'US'

  const { product: productData } = await fetchProduct(asin, marketplace)

  // Single unfiltered Canopy request — page 1, no star filter
  const reviews = await fetchOnePage(asin, domain)

  console.log(`[Scraper:free] "${productData.title.slice(0, 50)}" | ${reviews.length} reviews (1 page)`)

  return {
    product:   productData,
    reviews,
    qa:        [],
    scrapedAt: new Date().toISOString(),
    marketplace,
  }
}

async function fetchOnePage(asin: string, domain: string): Promise<AmazonReview[]> {
  try {
    const url = `${CANOPY_BASE}?asin=${asin}&domain=${domain}&page=1`
    const res = await canopyFetch(url)
    if (!res.ok) {
      console.warn(`[Scraper:free] Canopy page 1 HTTP ${res.status}`)
      return []
    }
    const data     = await res.json()
    const paginated = data?.data?.amazonProduct?.reviewsPaginated
    if (!paginated) return []
    return (paginated.reviews ?? []).map((r: CanopyReview, i: number) => ({
      id:       r.id ?? `${asin}-free-${i}`,
      rating:   r.rating ?? 3,
      title:    r.title ?? '',
      body:     r.body ?? '',
      date:     '',
      verified: r.verifiedPurchase ?? false,
      vine:     false,
      helpful:  r.helpfulVotes ?? 0,
      country:  domain.toLowerCase(),
    }))
  } catch (e) {
    console.warn('[Scraper:free] fetchOnePage exception:', e)
    return []
  }
}

// Fetch all 5 star tiers in parallel using pre-allocated page counts
async function fetchAllReviews(asin: string, domain: string, pageAlloc: Record<1 | 2 | 3 | 4 | 5, number>): Promise<AmazonReview[]> {
  const batches = await Promise.all(
    ([1, 2, 3, 4, 5] as const).map(star => fetchStarReviews(asin, domain, star, pageAlloc[star]))
  )
  return batches.flat()
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
      const url = `${CANOPY_BASE}?asin=${asin}&domain=${domain}&page=${page}&rating=${rating}`
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

  const res = await fetch(`${SCRAPINGDOG_BASE}?${params}`)
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
  // ScraperAPI only supports amazon.com — fallback only works for US marketplace
  const country = marketplace === 'amazon.com' ? 'us' : 'us'
  const params  = new URLSearchParams({ api_key: SCRAPERAPI_KEY, asin, country })

  const res = await fetch(`${SCRAPERAPI_BASE}?${params}`)
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
