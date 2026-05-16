import { AmazonScrapeResult, AmazonProduct, AmazonReview, AmazonQA } from './amazon-types'

const RAINFOREST_API_KEY = process.env.RAINFOREST_API_KEY!
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN!
const RAINFOREST_BASE = 'https://api.rainforestapi.com/request'
const APIFY_BASE = 'https://api.apify.com/v2'

// Target reviews per star rating — Apify charges per result so keep reasonable
const REVIEWS_PER_STAR = 40 // 40 × 5 = 200 max texts per analysis

export async function scrapeAmazon(input: string): Promise<AmazonScrapeResult> {
  const { asin, marketplace } = parseInput(input)
  console.log(`[Scraper] ASIN: ${asin} | Marketplace: ${marketplace}`)

  // Product and Q&A in parallel (both Rainforest type=product/questions — works on free plan)
  const [{ product: productData }, qaData] = await Promise.all([
    fetchProduct(asin, marketplace),
    fetchQA(asin, marketplace),
  ])

  // Reviews via Apify — fetch all stars in parallel (no Rainforest rate limit concern)
  const starBatches = await Promise.all(
    ([1, 2, 3, 4, 5] as const).map(star => fetchReviewsByStar(asin, marketplace, star))
  )

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

// sovereigntaylor/amazon-reviews-scraper star filter values
const STAR_FILTER_MAP: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'one_star',
  2: 'two_star',
  3: 'three_star',
  4: 'four_star',
  5: 'five_star',
}

async function fetchReviewsByStar(
  asin: string,
  marketplace: string,
  star: 1 | 2 | 3 | 4 | 5,
): Promise<AmazonReview[]> {
  try {
    // Build the Amazon domain format Apify expects (amazon.com, amazon.co.uk, etc.)
    const domain = marketplace.startsWith('amazon.') ? marketplace : `amazon.${marketplace}`

    const input = {
      asins: [asin],
      marketplace: domain,
      filterByStar: STAR_FILTER_MAP[star],
      maxReviews: REVIEWS_PER_STAR,
      // Proxy is handled by Apify internally
    }

    // Start the actor run
    const startRes = await fetch(
      `${APIFY_BASE}/acts/sovereigntaylor~amazon-reviews-scraper/runs?token=${APIFY_API_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }
    )

    if (!startRes.ok) {
      console.warn(`[Scraper] Apify ${star}★ start failed: HTTP ${startRes.status}`)
      return []
    }

    const { data: runData } = await startRes.json()
    const runId: string = runData.id

    // Poll until finished (timeout 90s)
    const deadline = Date.now() + 90_000
    let status = runData.status as string

    while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED') {
      if (Date.now() > deadline) {
        console.warn(`[Scraper] Apify ${star}★ run ${runId} timed out`)
        return []
      }
      await sleep(3000)

      const pollRes = await fetch(
        `${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
      )
      if (!pollRes.ok) {
        console.warn(`[Scraper] Apify ${star}★ poll failed: HTTP ${pollRes.status}`)
        return []
      }
      const { data: pollData } = await pollRes.json()
      status = pollData.status
    }

    if (status !== 'SUCCEEDED') {
      console.warn(`[Scraper] Apify ${star}★ run ended with status: ${status}`)
      return []
    }

    // Fetch dataset items
    const datasetRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}&limit=${REVIEWS_PER_STAR}`
    )
    if (!datasetRes.ok) {
      console.warn(`[Scraper] Apify ${star}★ dataset fetch failed: HTTP ${datasetRes.status}`)
      return []
    }

    const items: ApifyReviewItem[] = await datasetRes.json()
    const reviews = items.map(mapApifyReview)
    console.log(`[Scraper] ${star}★ reviews: ${reviews.length}`)
    return reviews
  } catch (e) {
    console.warn(`[Scraper] Apify ${star}★ exception:`, e)
    return []
  }
}

interface ApifyReviewItem {
  reviewId?: string
  ratingScore?: number
  reviewTitle?: string
  reviewDescription?: string
  date?: string
  isVerified?: boolean
  isVineVoice?: boolean
  helpfulVotes?: number
  reviewCountry?: string
}

function mapApifyReview(r: ApifyReviewItem): AmazonReview {
  return {
    id: r.reviewId ?? '',
    rating: r.ratingScore ?? 0,
    title: r.reviewTitle ?? '',
    body: r.reviewDescription ?? '',
    date: r.date ?? '',
    verified: r.isVerified ?? false,
    vine: r.isVineVoice ?? false,
    helpful: r.helpfulVotes ?? 0,
    country: r.reviewCountry ?? 'us',
  }
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
    const marketplace = host.replace('www.', '')
    const asinMatch = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
    if (!asinMatch) throw new Error('Could not extract ASIN from URL')
    return { asin: asinMatch[1].toUpperCase(), marketplace }
  } catch {
    throw new Error('Invalid input: provide an Amazon URL or ASIN (e.g. B073JYC4XM)')
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

  const res = await fetch(`${RAINFOREST_BASE}?${params}`)
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
    const res = await fetch(`${RAINFOREST_BASE}?${params}`)
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
