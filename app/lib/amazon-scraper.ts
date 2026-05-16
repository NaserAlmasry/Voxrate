import { AmazonScrapeResult, AmazonProduct, AmazonReview, AmazonQA } from './amazon-types'

const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY!
const CANOPY_API_KEY = process.env.CANOPY_API_KEY!
const SCRAPINGDOG_BASE = 'https://api.scrapingdog.com/amazon/product'
const CANOPY_BASE = 'https://rest.canopyapi.co/api/amazon/product/reviews'

// Max pages to fetch per star (each page ~10 reviews, so 2 pages = ~20 per star = 100 total)
const MAX_PAGES_PER_STAR = 2

const STAR_FILTER_MAP: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'ONE_STAR',
  2: 'TWO_STAR',
  3: 'THREE_STAR',
  4: 'FOUR_STAR',
  5: 'FIVE_STAR',
}

// Maps amazon marketplace domain to Canopy domain code
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

  // Product + Q&A via Rainforest, reviews via Canopy — all in parallel
  const [{ product: productData }, qaData, allReviews] = await Promise.all([
    fetchProduct(asin, marketplace),
    fetchQA(asin, marketplace),
    fetchAllReviews(asin, domain),
  ])

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

// Fetch all 5 star tiers in parallel
async function fetchAllReviews(asin: string, domain: string): Promise<AmazonReview[]> {
  const batches = await Promise.all(
    ([1, 2, 3, 4, 5] as const).map(star => fetchStarReviews(asin, domain, star))
  )
  return batches.flat()
}

async function fetchStarReviews(
  asin: string,
  domain: string,
  star: 1 | 2 | 3 | 4 | 5,
): Promise<AmazonReview[]> {
  const reviews: AmazonReview[] = []
  const rating = STAR_FILTER_MAP[star]

  for (let page = 1; page <= MAX_PAGES_PER_STAR; page++) {
    try {
      const url = `${CANOPY_BASE}?asin=${asin}&domain=${domain}&page=${page}&rating=${rating}`
      const res = await fetch(url, {
        headers: { 'API-KEY': CANOPY_API_KEY, 'accept': 'application/json' },
      })

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
  const { country, domain } = toScrapingdogParams(marketplace)
  const params = new URLSearchParams({
    api_key: SCRAPINGDOG_API_KEY,
    asin,
    country,
    domain,
  })

  const res = await fetch(`${SCRAPINGDOG_BASE}?${params}`)
  if (!res.ok) throw new Error(`Scrapingdog product fetch failed: ${res.status}`)

  const p = await res.json()
  console.log(`[Scraper] Product: "${String(p?.title ?? '').slice(0, 60)}" | Total reviews: ${p?.product_information?.['Customer Reviews']?.ratings_count}`)

  // ratings_distribution gives percentages — convert to counts
  const totalReviews = parseInt(String(p?.total_reviews ?? '0').replace(/\D/g, '')) || 0
  const dist: Array<{ rating: number; distribution: string }> = p?.ratings_distribution ?? []
  const pct = (star: number) => {
    const entry = dist.find(d => d.rating === star)
    return entry ? Math.round(totalReviews * (parseFloat(entry.distribution) / 100)) : 0
  }
  const ratingBreakdown = { five: pct(5), four: pct(4), three: pct(3), two: pct(2), one: pct(1) }

  // Parse BSR: "#391 in Electronics (See Top 100...) #1 in Portable..."
  const bsrRaw: string = p?.product_information?.['Best Sellers Rank'] ?? ''
  const bsrMatch = bsrRaw.match(/#([\d,]+)\s+in\s+([^(#\n]+)/)
  const bsr = bsrMatch ? parseInt(bsrMatch[1].replace(/,/g, '')) : null
  const bsrCategory = bsrMatch ? bsrMatch[2].trim() : null

  // Parse price: "$29.99 with 88 percent savings" → 29.99
  const priceMatch = String(p?.price ?? '').match(/\$([\d.]+)/)
  const price = priceMatch ? parseFloat(priceMatch[1]) : null

  const product: AmazonProduct = {
    asin,
    marketplace,
    title: p?.title ?? '',
    brand: p?.product_information?.['Brand Name'] ?? '',
    mainImage: p?.main_image ?? '',
    images: p?.images ?? [],
    imageCount: (p?.images ?? []).length,
    videoCount: p?.number_of_videos ?? 0,
    hasAplus: p?.aplus ?? false,
    bulletPoints: p?.feature_bullets ?? [],
    description: '',
    bsr,
    bsrCategory,
    price,
    currency: 'USD',
    category: p?.product_category ?? '',
    categoriesFlat: p?.product_category ?? '',
    averageRating: parseFloat(p?.average_rating ?? '0') || 0,
    totalReviews,
    ratingBreakdown,
    specifications: [],
    recentSales: p?.number_of_people_bought ?? null,
    isFBA: String(p?.ships_from ?? '').toLowerCase().includes('amazon'),
  }

  return { product }
}

// Q&A not available via Scrapingdog — return empty
async function fetchQA(_asin: string, _marketplace: string): Promise<AmazonQA[]> {
  return []
}
