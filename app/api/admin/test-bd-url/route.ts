import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

const BRIGHTDATA_DATASET = 'gd_le8e811kzy4ggddlq'

async function fetchAndParse(url: string, maxReviews: number, key: string) {
  const res = await fetch(
    `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${BRIGHTDATA_DATASET}&notify=false&include_errors=true`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ input: [{ url, max_reviews: maxReviews }] }),
      signal:  AbortSignal.timeout(40_000),
    }
  )
  const text = await res.text()
  const lines = text.trim().split('\n').filter(Boolean)

  let reviewCount = 0
  let skippedRating0 = 0
  const ratingFieldUsed: Record<string, number> = { r_rating: 0, review_rating: 0, star_rating: 0, unresolved: 0 }
  const ratings: number[] = []
  const errors: string[] = []

  for (const line of lines) {
    try {
      const r = JSON.parse(line)
      if (r.error) { errors.push(r.error); continue }
      if (!r.review_text) continue

      // Track which field resolves the rating
      let rawRating = 0
      if (r.rating && r.rating >= 1 && r.rating <= 5)              { rawRating = r.rating;        ratingFieldUsed.r_rating++ }
      else if (r.review_rating && r.review_rating >= 1)            { rawRating = r.review_rating; ratingFieldUsed.review_rating++ }
      else if (r.star_rating && r.star_rating >= 1)                { rawRating = r.star_rating;   ratingFieldUsed.star_rating++ }
      else                                                          { ratingFieldUsed.unresolved++ }

      const rating = rawRating >= 1 && rawRating <= 5 ? Math.round(rawRating) : 0
      if (rating === 0) { skippedRating0++; continue }

      reviewCount++
      ratings.push(rating)
    } catch { /* skip */ }
  }

  return {
    httpStatus: res.status,
    totalLines: lines.length,
    reviewCount,
    skippedRating0,
    ratingFieldUsed,
    ratingDistribution: {
      '1★': ratings.filter(r => r === 1).length,
      '2★': ratings.filter(r => r === 2).length,
      '3★': ratings.filter(r => r === 3).length,
      '4★': ratings.filter(r => r === 4).length,
      '5★': ratings.filter(r => r === 5).length,
    },
    errorCount: errors.length,
    firstError: errors[0] ?? null,
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const key = process.env.BRIGHTDATA_API_KEY
  if (!key) return NextResponse.json({ error: 'No BD key' }, { status: 500 })

  const asin = 'B0C5JP7HN7'

  const dpUrl       = `https://www.amazon.com/dp/${asin}`
  const fiveStarUrl = `https://www.amazon.com/product-reviews/${asin}/ref=cm_cr_dp_d_show_all_btm?filterByStar=five_star&reviewerType=all_reviews`

  const [dpResult, fiveStarResult] = await Promise.allSettled([
    fetchAndParse(dpUrl, 15, key),
    fetchAndParse(fiveStarUrl, 15, key),
  ])

  return NextResponse.json({
    dp:       dpResult.status       === 'fulfilled' ? dpResult.value       : { error: (dpResult as any).reason?.message },
    fiveStar: fiveStarResult.status === 'fulfilled' ? fiveStarResult.value : { error: (fiveStarResult as any).reason?.message },
  })
}
