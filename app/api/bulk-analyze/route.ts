import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkCsrf } from '@/app/lib/csrf'

const ASIN_RE = /^[A-Z0-9]{10}$/

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please log in first' }, { status: 401 })

  const body = await request.json()
  const rawAsins: unknown = body?.asins
  const marketplace: unknown = body?.marketplace

  if (!Array.isArray(rawAsins) || rawAsins.length === 0) {
    return NextResponse.json({ error: 'asins must be a non-empty array' }, { status: 400 })
  }
  if (rawAsins.length > 10) {
    return NextResponse.json({ error: 'Maximum 10 ASINs per bulk request' }, { status: 400 })
  }
  if (typeof marketplace !== 'string' || !marketplace.trim()) {
    return NextResponse.json({ error: 'marketplace is required' }, { status: 400 })
  }

  const asins = rawAsins.map((a: unknown) => String(a ?? '').trim().toUpperCase())
  const invalid = asins.filter(a => !ASIN_RE.test(a))
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Invalid ASINs: ${invalid.join(', ')}. ASINs must be 10 alphanumeric characters.` }, { status: 400 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('plan, is_admin')
    .eq('id', user.id)
    .single()

  const isAdmin = userData?.is_admin === true
  const plan    = userData?.plan || 'free'

  if (!isAdmin) {
    const BULK_CAP: Record<string, number> = { free: 2, trial: 2, starter: 3, growth: 5, pro: 10 }
    const maxBulk = BULK_CAP[plan] ?? 3
    if (asins.length > maxBulk) {
      return NextResponse.json(
        { error: `Your plan allows up to ${maxBulk} ASINs per bulk request. Upgrade for more.`, upgradeRequired: !isAdmin },
        { status: 403 },
      )
    }
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const jobs: { asin: string; jobId: string }[] = []

  for (const asin of asins) {
    const { data: job, error } = await adminSupabase
      .from('extension_jobs')
      .insert({
        user_id:     user.id,
        asin,
        marketplace: marketplace.trim(),
        max_reviews: 150,
        status:      'pending',
      })
      .select('id')
      .single()

    if (error || !job) {
      console.error('[BulkAnalyze] Job insert failed:', error?.message)
      return NextResponse.json({ error: 'Failed to queue jobs. Please try again.' }, { status: 500 })
    }

    jobs.push({ asin, jobId: job.id })
  }

  return NextResponse.json({ jobs })
}
