import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getUserFromToken(token: string) {
  const supabase = adminClient()
  const { data } = await supabase
    .from('extension_sessions')
    .select('user_id')
    .eq('token', token)
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

  const supabase = adminClient()
  const userId = session.user_id

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

  // Save new snapshot
  await supabase.from('listing_snapshots').insert({
    user_id: userId,
    asin,
    marketplace,
    title: body.title || null,
    bullets: body.bullets ? body.bullets : null,
    main_image: body.main_image || null,
    price: body.price ?? null,
    review_count: body.review_count ?? null,
    average_rating: body.average_rating ?? null,
    buy_box_seller: body.buy_box_seller || null,
    is_suppressed: body.is_suppressed ?? false,
  })

  if (!prev) return NextResponse.json({ ok: true, changed: false })

  // Diff
  const changes: string[] = []
  if (prev.title && body.title && prev.title !== body.title) changes.push(`Title changed`)
  if (prev.main_image && body.main_image && prev.main_image !== body.main_image) changes.push(`Main image changed`)
  if (prev.price != null && body.price != null && Math.abs(prev.price - body.price) > 0.01) {
    changes.push(`Price changed from $${prev.price} to $${body.price}`)
  }
  if (prev.buy_box_seller && body.buy_box_seller && prev.buy_box_seller !== body.buy_box_seller) {
    changes.push(`Buy Box seller changed from "${prev.buy_box_seller}" to "${body.buy_box_seller}"`)
  }
  if (!prev.is_suppressed && body.is_suppressed) changes.push(`Listing may be suppressed`)

  if (changes.length > 0) {
    await supabase.from('alerts').insert({
      user_id: userId,
      type: 'listing_change',
      severity: 'warning',
      title: `Listing change detected on ${asin}`,
      body: changes.join('; '),
      asin,
      data: { changes, prev: { title: prev.title, price: prev.price, buy_box_seller: prev.buy_box_seller }, current: body },
    })
  }

  return NextResponse.json({ ok: true, changed: changes.length > 0, changes })
}
