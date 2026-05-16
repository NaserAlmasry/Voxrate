import { AmazonScrapeResult, AmazonProduct, AmazonReview, AmazonQA } from './amazon-types'

const RAINFOREST_API_KEY = process.env.RAINFOREST_API_KEY!
const BASE_URL = 'https://api.rainforestapi.com/request'

// Accepts full Amazon URL (any marketplace) or bare ASIN
// Examples:
//   https://www.amazon.com/dp/B073JYC4XM
//   https://www.amazon.co.uk/dp/B073JYC4XM
//   B073JYC4XM
export async function scrapeAmazon(input: string): Promise<AmazonScrapeResult> {
  const { asin, marketplace } = parseInput(input)
  console.log(`[Scraper] ASIN: ${asin} | Marketplace: ${marketplace}`)

  // Fetch product first — we need top_reviews as fallback if reviews API returns empty
  const { product: productData, topReviews } = await fetchProduct(asin, marketplace)

  // Fetch reviews and Q&A in parallel
  const [reviewsData, qaData] = await Promise.all([
    fetchReviews(asin, marketplace, topReviews),
    fetchQA(asin, marketplace),
  ])

  console.log(`[Scraper] Got ${reviewsData.length} reviews, ${qaData.length} Q&A items`)

  return {
    product: productData,
    reviews: reviewsData,
    qa: qaData,
    scrapedAt: new Date().toISOString(),
    marketplace,
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

async function fetchProduct(asin: string, marketplace: string): Promise<{ product: AmazonProduct; topReviews: AmazonReview[] }> {
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

  // top_reviews from product call — used as fallback if reviews API returns empty
  const topReviews: AmazonReview[] = (p.top_reviews ?? []).map(mapRawReview)

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

  return { product, topReviews }
}

async function fetchReviews(asin: string, marketplace: string, fallback: AmazonReview[]): Promise<AmazonReview[]> {
  const allReviews: AmazonReview[] = []
  let page = 1
  const maxPages = 10 // 10 pages × ~10 reviews = ~100 reviews max (credit-efficient)

  while (page <= maxPages) {
    const params = new URLSearchParams({
      api_key: RAINFOREST_API_KEY,
      type: 'reviews',
      asin,
      amazon_domain: marketplace,
      page: String(page),
    })

    const res = await fetch(`${BASE_URL}?${params}`)
    if (!res.ok) {
      console.warn(`[Scraper] Reviews fetch failed on page ${page}: HTTP ${res.status}`)
      break
    }

    const data = await res.json()
    if (!data.request_info?.success) {
      console.warn(`[Scraper] Reviews API unsuccessful on page ${page}:`, JSON.stringify(data.request_info))
      break
    }

    const reviews: AmazonReview[] = (data.reviews ?? []).map(mapRawReview)
    console.log(`[Scraper] Page ${page}: ${reviews.length} reviews (total: ${allReviews.length + reviews.length})`)

    if (reviews.length === 0) break
    allReviews.push(...reviews)
    page++
  }

  console.log(`[Scraper] Reviews fetch complete. Got ${allReviews.length} total.`)

  // Fall back to top_reviews from product call if dedicated reviews fetch returned nothing
  if (allReviews.length === 0 && fallback.length > 0) {
    console.warn(`[Scraper] Reviews API empty — using ${fallback.length} top_reviews from product call`)
    return fallback
  }

  return allReviews
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
