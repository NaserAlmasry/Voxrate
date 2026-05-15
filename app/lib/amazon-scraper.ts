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

  const [productData, reviewsData, qaData] = await Promise.all([
    fetchProduct(asin, marketplace),
    fetchReviews(asin, marketplace),
    fetchQA(asin, marketplace),
  ])

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

async function fetchProduct(asin: string, marketplace: string): Promise<AmazonProduct> {
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
  if (!data.request_info?.success) throw new Error('Rainforest API returned unsuccessful response')

  const p = data.product

  const ratingBreakdown = {
    five: p.rating_breakdown?.five_star?.count ?? 0,
    four: p.rating_breakdown?.four_star?.count ?? 0,
    three: p.rating_breakdown?.three_star?.count ?? 0,
    two: p.rating_breakdown?.two_star?.count ?? 0,
    one: p.rating_breakdown?.one_star?.count ?? 0,
  }

  return {
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
}

async function fetchReviews(asin: string, marketplace: string): Promise<AmazonReview[]> {
  const allReviews: AmazonReview[] = []
  let page = 1
  const maxPages = 20 // up to 400 reviews (20 per page)

  while (page <= maxPages) {
    const params = new URLSearchParams({
      api_key: RAINFOREST_API_KEY,
      type: 'reviews',
      asin,
      amazon_domain: marketplace,
      page: String(page),
      sort_by: 'recent',
    })

    const res = await fetch(`${BASE_URL}?${params}`)
    if (!res.ok) break

    const data = await res.json()
    if (!data.request_info?.success) break

    const reviews: AmazonReview[] = (data.reviews ?? []).map((r: {
      id: string
      rating: number
      title: string
      body: string
      date?: { utc?: string }
      verified_purchase?: boolean
      vine_program?: boolean
      helpful_votes?: number
      review_country?: string
    }) => ({
      id: r.id,
      rating: r.rating,
      title: r.title ?? '',
      body: r.body ?? '',
      date: r.date?.utc ?? '',
      verified: r.verified_purchase ?? false,
      vine: r.vine_program ?? false,
      helpful: r.helpful_votes ?? 0,
      country: r.review_country ?? 'us',
    }))

    if (reviews.length === 0) break
    allReviews.push(...reviews)
    if (reviews.length < 10) break // last page
    page++
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
