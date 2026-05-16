import { AmazonScrapeResult, AmazonProduct, AmazonReview, AmazonQA } from './amazon-types'

const RAINFOREST_API_KEY = process.env.RAINFOREST_API_KEY!
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN!
const RAINFOREST_BASE = 'https://api.rainforestapi.com/request'
const APIFY_BASE = 'https://api.apify.com/v2'

// 10 pages × 10 reviews = 100 per star, 500 total (web_wanderer actor max)
const PAGES_PER_STAR = 10

export async function scrapeAmazon(input: string): Promise<AmazonScrapeResult> {
  const { asin, marketplace } = parseInput(input)
  console.log(`[Scraper] ASIN: ${asin} | Marketplace: ${marketplace}`)

  // Product + Q&A via Rainforest, reviews via Apify — all in parallel
  const [{ product: productData }, qaData, allReviews] = await Promise.all([
    fetchProduct(asin, marketplace),
    fetchQA(asin, marketplace),
    fetchAllReviews(asin, marketplace),
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// sovereigntaylor/amazon-reviews-scraper
// 5 parallel runs, one per star rating, 100 reviews each
async function fetchAllReviews(asin: string, marketplace: string): Promise<AmazonReview[]> {
  const batches = await Promise.all(
    ([1, 2, 3, 4, 5] as const).map(star => fetchStarBatch(asin, marketplace, star))
  )
  return batches.flat()
}

const STAR_FILTER_MAP: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'one_star', 2: 'two_star', 3: 'three_star', 4: 'four_star', 5: 'five_star',
}

async function fetchStarBatch(asin: string, marketplace: string, star: 1 | 2 | 3 | 4 | 5): Promise<AmazonReview[]> {
  try {
    const runInput = {
      asins: [asin],
      marketplace,
      filterByRating: STAR_FILTER_MAP[star],
      maxReviews: PAGES_PER_STAR * 10,
      sortBy: 'recent',
    }

    const startRes = await fetch(
      `${APIFY_BASE}/acts/sovereigntaylor~amazon-reviews-scraper/runs?token=${APIFY_API_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runInput),
      }
    )

    if (!startRes.ok) {
      console.warn(`[Scraper] Apify ${star}★ start failed: HTTP ${startRes.status}`)
      return []
    }

    const { data: runData } = await startRes.json()
    const runId: string = runData.id

    // Poll until finished (timeout 120s per star)
    const deadline = Date.now() + 120_000
    let status = runData.status as string

    while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED') {
      if (Date.now() > deadline) {
        console.warn(`[Scraper] Apify ${star}★ run timed out`)
        return []
      }
      await sleep(3000)

      const pollRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_API_TOKEN}`)
      if (!pollRes.ok) return []
      const { data: pollData } = await pollRes.json()
      status = pollData.status
    }

    if (status !== 'SUCCEEDED') {
      console.warn(`[Scraper] Apify ${star}★ ended with: ${status}`)
      return []
    }

    const datasetRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}&limit=200`
    )
    if (!datasetRes.ok) return []

    const items: SovereignReviewItem[] = await datasetRes.json()
    const reviews = items.filter(r => r.reviewId).map(mapSovereignReview)
    console.log(`[Scraper] ${star}★ — ${reviews.length} reviews`)
    return reviews
  } catch (e) {
    console.warn(`[Scraper] Apify ${star}★ exception:`, e)
    return []
  }
}

interface SovereignReviewItem {
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

function mapSovereignReview(r: SovereignReviewItem): AmazonReview {
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
