import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/app/lib/supabase/server'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const asin = req.nextUrl.searchParams.get('asin')
  if (!asin) return NextResponse.json({ error: 'Missing asin' }, { status: 400 })

  const admin = adminClient()
  const { data: snapshots } = await admin
    .from('listing_snapshots')
    .select('asin, title, bullets, price, captured_at, review_count, average_rating, buy_box_seller, is_suppressed')
    .eq('user_id', user.id)
    .eq('asin', asin)
    .order('captured_at', { ascending: false })
    .limit(2)

  return NextResponse.json({ data: snapshots || [] })
}

async function getUserFromToken(token: string) {
  const supabase = adminClient()
  const { data } = await supabase
    .from('extension_sessions')
    .select('user_id')
    .eq('token', token)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()
  return data
}

interface SnapshotPayload {
  asin: string
  marketplace?: string
  title?: string
  bullets?: string[]
  main_image?: string
  price?: number
  review_count?: number
  average_rating?: number
  buy_box_seller?: string
  is_suppressed?: boolean
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getUserFromToken(token)
  if (!session) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  let body: SnapshotPayload
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { asin, marketplace = 'amazon.com' } = body
  if (!asin) return NextResponse.json({ error: 'Missing asin' }, { status: 400 })
  if (!/^[A-Z0-9]{10}$/.test(asin)) return NextResponse.json({ error: 'Invalid asin' }, { status: 400 })

  const supabase = adminClient()
  const userId = session.user_id

  // Only process watched ASINs
  const { data: monitored } = await supabase
    .from('monitored_asins')
    .select('id')
    .eq('user_id', userId)
    .eq('asin', asin)
    .maybeSingle()
  if (!monitored) return NextResponse.json({ ok: true, changed: false })

  // Get last snapshot
  const { data: prev } = await supabase
    .from('listing_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('asin', asin)
    .eq('marketplace', marketplace)
    .order('captured_at', { ascending: false })
    .limit(1)
    .single()

  // Sanitize and cap payload fields before storage
  const safeTitle = typeof body.title === 'string' ? body.title.slice(0, 500) : null
  const safeBullets = Array.isArray(body.bullets)
    ? body.bullets.slice(0, 30).map((b: unknown) => typeof b === 'string' ? b.slice(0, 1000) : '').filter(Boolean)
    : null
  const safeImage = typeof body.main_image === 'string' ? body.main_image.slice(0, 1000) : null
  const safePrice = typeof body.price === 'number' && isFinite(body.price) && body.price >= 0 && body.price < 100000 ? body.price : null
  const safeReviewCount = typeof body.review_count === 'number' && isFinite(body.review_count) && body.review_count >= 0 ? Math.round(body.review_count) : null
  const safeRating = typeof body.average_rating === 'number' && isFinite(body.average_rating) && body.average_rating >= 0 && body.average_rating <= 5 ? body.average_rating : null
  const safeBuyBox = typeof body.buy_box_seller === 'string' ? body.buy_box_seller.slice(0, 200) : null

  // Save new snapshot
  await supabase.from('listing_snapshots').insert({
    user_id: userId,
    asin,
    marketplace,
    title: safeTitle,
    bullets: safeBullets,
    main_image: safeImage,
    price: safePrice,
    review_count: safeReviewCount,
    average_rating: safeRating,
    buy_box_seller: safeBuyBox,
    is_suppressed: body.is_suppressed === true,
  })

  if (!prev) return NextResponse.json({ ok: true, changed: false })

  // Diff — compare against sanitized safe* values (same as what was stored)
  const changes: string[] = []
  const prevTitle = prev.title ?? null
  if (prevTitle !== null && prevTitle !== safeTitle) changes.push(`Title changed`)

  const prevImage = prev.main_image ?? null
  if (prevImage !== null && prevImage !== safeImage) changes.push(`Main image changed`)

  if (prev.price != null && safePrice != null && Math.abs(prev.price - safePrice) > 0.01) {
    changes.push(`Price changed from $${prev.price} to $${safePrice}`)
  }

  const prevBB = prev.buy_box_seller ?? null
  if (prevBB !== null && prevBB !== safeBuyBox) {
    changes.push(`Buy Box seller changed from "${prevBB}" to "${safeBuyBox ?? 'unknown'}"`)
  }
  if (!prev.is_suppressed && body.is_suppressed === true) changes.push(`Listing may be suppressed`)

  if (changes.length > 0) {
    await supabase.from('alerts').insert({
      user_id: userId,
      type: 'listing_change',
      severity: 'warning',
      title: `Listing change detected on ${asin}`,
      body: changes.join('; '),
      asin,
      data: { changes, prev: { title: prev.title, price: prev.price, buy_box_seller: prev.buy_box_seller }, current: { title: safeTitle, price: safePrice, buy_box_seller: safeBuyBox } },
    })
  }

  return NextResponse.json({ ok: true, changed: changes.length > 0, changes })
}
