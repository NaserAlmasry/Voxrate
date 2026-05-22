import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

const BRIGHTDATA_DATASET = 'gd_le8e811kzy4ggddlq'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const key = process.env.BRIGHTDATA_API_KEY
  if (!key) return NextResponse.json({ error: 'No BD key' }, { status: 500 })

  const asin = 'B0C5JP7HN7' // Withings scale — known product

  const urls = {
    dp:       `https://www.amazon.com/dp/${asin}`,
    critical: `https://www.amazon.com/product-reviews/${asin}/ref=cm_cr_dp_d_show_all_btm?filterByStar=critical&reviewerType=all_reviews`,
    fiveStar: `https://www.amazon.com/product-reviews/${asin}/ref=cm_cr_dp_d_show_all_btm?filterByStar=five_star&reviewerType=all_reviews`,
  }

  const results: Record<string, any> = {}

  for (const [label, url] of Object.entries(urls)) {
    try {
      const res = await fetch(
        `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${BRIGHTDATA_DATASET}&notify=false&include_errors=true`,
        {
          method:  'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ input: [{ url, max_reviews: 10 }] }),
          signal:  AbortSignal.timeout(40_000),
        }
      )
      const text = await res.text()
      const lines = text.trim().split('\n').filter(Boolean)
      const parsed = lines.map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
      const reviews = parsed.filter((r: any) => r.review_text)
      const errors  = parsed.filter((r: any) => r.error)
      const ratings = reviews.map((r: any) => r.rating || r.review_rating || r.star_rating || 0)

      results[label] = {
        httpStatus:   res.status,
        totalLines:   lines.length,
        reviewCount:  reviews.length,
        errorCount:   errors.length,
        ratings,
        firstError:   errors[0]?.error ?? null,
      }
    } catch (err: any) {
      results[label] = { error: err.message }
    }
  }

  return NextResponse.json(results)
}
