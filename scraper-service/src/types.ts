export interface ScrapeRequest {
  url: string        // full Amazon product-reviews URL
  asin: string
  marketplace: string
  maxReviews: number
}

export interface Review {
  id: string
  rating: number
  title: string
  body: string
  date: string
  verified: boolean
  helpful: number
  country: string
}

export type JobStatus = 'pending' | 'running' | 'done' | 'error'

export interface Job {
  id: string
  request: ScrapeRequest
  status: JobStatus
  reviews?: Review[]
  error?: string
  createdAt: number
}
