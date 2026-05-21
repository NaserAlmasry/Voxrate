export interface AmazonProduct {
  asin: string
  marketplace: string
  title: string
  brand: string
  mainImage: string
  images: string[]
  imageCount: number
  videoCount: number
  hasAplus: boolean
  bulletPoints: string[]
  description: string
  bsr: number | null
  bsrCategory: string | null
  price: number | null
  currency: string
  category: string
  categoriesFlat: string
  averageRating: number
  totalReviews: number
  ratingBreakdown: {
    five: number
    four: number
    three: number
    two: number
    one: number
  }
  specifications: Array<{ name: string; value: string }>
  recentSales: string | null
  isFBA: boolean
}

export interface AmazonReview {
  id: string
  rating: number
  title: string
  body: string
  date: string
  verified: boolean
  vine: boolean
  helpful: number
  country: string
}

export interface AmazonQA {
  question: string
  answer: string | null
  votes: number
}

export interface AmazonScrapeResult {
  product: AmazonProduct
  reviews: AmazonReview[]
  qa: AmazonQA[]
  scrapedAt: string
  marketplace: string
  fromCache?: boolean
  scraperProvider?: string
  scraperPages?: number
}
