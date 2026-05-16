import { AmazonScrapeResult, AmazonProduct, AmazonReview, AmazonQA } from './amazon-types'

const RAINFOREST_API_KEY = process.env.RAINFOREST_API_KEY!
const BASE_URL = 'https://api.rainforestapi.com/request'

// Accepts full Amazon URL (any marketplace) or bare ASIN
// Examples:
//   https://www.amazon.com/dp/B073JYC4XM
//   https://www.amazon.co.uk/dp/B073JYC4XM
//   B073JYC4XM
// How many pages to fetch per star rating (1 page = ~10 reviews)
// 3 pages × 5 stars = up to 150 review texts total
// Credits: 1 product + 15 reviews + 1 Q&A = 17 per analysis
const PAGES_PER_STAR = 3

export async function scrapeAmazon(input: string): Promise<AmazonScrapeResult> {
  const { asin, marketplace } = parseInput(input)
  console.log(`[Scraper] ASIN: ${asin} | Marketplace: ${marketplace}`)

  // Product and Q&A in parallel first
  const [{ product: productData }, qaData] = await Promise.all([
    fetchProduct(asin, marketplace),
    fetchQA(asin, marketplace),
  ])

  // Star-filtered review batches run sequentially to avoid Rainforest rate limiting
  // 300ms gap between each star to stay within their per-second limit
  const starBatches: AmazonReview[][] = []
  for (const star of [1, 2, 3, 4, 5] as const) {
    const batch = await fetchReviewsByStar(asin, marketplace, star)
    starBatches.push(batch)
    await sleep(300)
  }

  const allReviews: AmazonReview[] = starBatches.flat()

  console.log(
    `[Scraper] "${productData.title.slice(0, 50)}" | ` +
    `${productData.totalReviews} total ratings | ` +
    `${allReviews.length} texts (1★:${starBatches[0].length} ` +
    `2★:${starBatches[1].length} ` +
    `3★:${starBatches[2].length} ` +
    `4★:${starBatches[3].length} ` +
    `5★:${starBatches[4].length}) | ` +
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const STAR_FILTER_MAP: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'one_star',
  2: 'two_star',
  3: 'three_star',
  4: 'four_star',
  5: 'five_star',
}

// Fetches up to PAGES_PER_STAR pages of reviews for a specific star rating
async function fetchReviewsByStar(
  asin: string,
  marketplace: string,
  star: 1 | 2 | 3 | 4 | 5,
): Promise<AmazonReview[]> {
  const reviews: AmazonReview[] = []

  for (let page = 1; page <= PAGES_PER_STAR; page++) {
    const params = new URLSearchParams({
      api_key:        RAINFOREST_API_KEY,
      type:           'reviews',
      asin,
      amazon_domain:  marketplace,
      filter_by_star: STAR_FILTER_MAP[star],
      page:           String(page),
    })

    try {
      let res = await fetch(`${BASE_URL}?${params}`)

      // Retry once on 503 after a short back-off
      if (res.status === 503) {
        console.warn(`[Scraper] ${star}★ page ${page} 503 — retrying in 1s`)
        await sleep(1000)
        res = await fetch(`${BASE_URL}?${params}`)
      }

      if (!res.ok) {
        console.warn(`[Scraper] ${star}★ page ${page} HTTP ${res.status} — stopping this star`)
        break
      }

      const data = await res.json()
      if (!data.request_info?.success) {
        console.warn(`[Scraper] ${star}★ page ${page} API error:`, JSON.stringify(data.request_info))
        break
      }

      const batch: AmazonReview[] = (data.reviews ?? []).map(mapRawReview)
      if (batch.length === 0) break
      reviews.push(...batch)
    } catch (e) {
      console.warn(`[Scraper] ${star}★ page ${page} exception:`, e)
      break
    }
  }

  console.log(`[Scraper] ${star}★ reviews: ${reviews.length}`)
  return reviews
}

function parseInput(input: string): { asin: string; marketplace: string } {
  input = input.trim()

  // Bare ASIN: 10 chars, starts with B or is numeric
  if (/^[A-Z0-9]{10}$/i.test(input)) {
    return { asin: input.toUpperCase(), marketplace: 'amazon.com' }
  }

  // Full URL
  try {
    const url = new URL(input)
    const host = url.hostname.toLowerCase()

    // Extract marketplace from hostname
    const marketplace = host.replace('www.', '')

    // Extract ASIN from URL patterns: /dp/ASIN or /gp/product/ASIN
    const asinMatch = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
    if (!asinMatch) throw new Error('Could not extract ASIN from URL')

    return { asin: asinMatch[1].toUpperCase(), marketplace }
  } catch {
    throw new Error('Invalid input: provide an Amazon URL or ASIN (e.g. B073JYC4XM)')
  }
}

function mapRawReview(r: {
  id?: string
  rating?: number
  title?: string
  body?: string
  date?: { utc?: string }
  verified_purchase?: boolean
  vine_program?: boolean
  helpful_votes?: number
  review_country?: string
}): AmazonReview {
  return {
    id: r.id ?? '',
    rating: r.rating ?? 0,
    title: r.title ?? '',
    body: r.body ?? '',
    date: r.date?.utc ?? '',
    verified: r.verified_purchase ?? false,
    vine: r.vine_program ?? false,
    helpful: r.helpful_votes ?? 0,
    country: r.review_country ?? 'us',
  }
}

async function fetchProduct(asin: string, marketplace: string): Promise<{ product: AmazonProduct }> {
  const params = new URLSearchParams({
    api_key: RAINFOREST_API_KEY,
    type: 'product',
    asin,
    amazon_domain: marketplace,
    include_summarization_attributes: 'true',
  })

  const res = await fetch(`${BASE_URL}?${params}`)
  if (!res.ok) throw new Error(`Rainforest product fetch failed: ${res.status}`)

  const data = await res.json()
  if (!data.request_info?.success) throw new Error(`Rainforest API error: ${JSON.stringify(data.request_info)}`)

  const p = data.product
  console.log(`[Scraper] Product: "${p?.title?.slice(0, 60)}" | Total reviews: ${p?.ratings_total}`)

  const ratingBreakdown = {
    five: p.rating_breakdown?.five_star?.count ?? 0,
    four: p.rating_breakdown?.four_star?.count ?? 0,
    three: p.rating_breakdown?.three_star?.count ?? 0,
    two: p.rating_breakdown?.two_star?.count ?? 0,
    one: p.rating_breakdown?.one_star?.count ?? 0,
  }

  const product: AmazonProduct = {
    asin: p.asin,
    marketplace,
    title: p.title ?? '',
    brand: p.brand ?? '',
    mainImage: p.main_image?.link ?? '',
    images: (p.images ?? []).map((img: { link: string }) => img.link),
    imageCount: p.images_count ?? 0,
    videoCount: p.videos_count ?? 0,
    hasAplus: p.a_plus_content?.has_a_plus_content ?? false,
    bulletPoints: p.feature_bullets ?? [],
    description: p.description ?? '',
    bsr: p.bestsellers_rank?.[0]?.rank ?? null,
    bsrCategory: p.bestsellers_rank?.[0]?.category ?? null,
    price: p.buybox_winner?.price?.value ?? null,
    currency: p.buybox_winner?.price?.currency ?? 'USD',
    category: p.categories?.[0]?.name ?? '',
    categoriesFlat: p.categories_flat ?? '',
    averageRating: p.rating ?? 0,
    totalReviews: p.ratings_total ?? 0,
    ratingBreakdown,
    specifications: p.specifications ?? [],
    recentSales: p.recent_sales ?? null,
    isFBA: p.buybox_winner?.fulfillment?.is_fulfilled_by_amazon ?? false,
  }

  return { product }
}


async function fetchQA(asin: string, marketplace: string): Promise<AmazonQA[]> {
  const params = new URLSearchParams({
    api_key: RAINFOREST_API_KEY,
    type: 'questions',
    asin,
    amazon_domain: marketplace,
  })

  try {
    const res = await fetch(`${BASE_URL}?${params}`)
    if (!res.ok) return []

    const data = await res.json()
    if (!data.request_info?.success) return []

    return (data.questions ?? []).map((q: {
      question: string
      answers?: Array<{ body?: string }>
      votes?: number
    }) => ({
      question: q.question,
      answer: q.answers?.[0]?.body ?? null,
      votes: q.votes ?? 0,
    }))
  } catch {
    return []
  }
}
