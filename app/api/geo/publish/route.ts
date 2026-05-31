import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkCsrf } from '@/app/lib/csrf'
import { checkRateLimit } from '@/app/lib/rate-limit'
import { revalidatePath } from 'next/cache'

const PLAN_LIMITS: Record<string, number> = { starter: 3, growth: 10, pro: Infinity }
const AMAZON_URL_RE = /^https:\/\/(www\.)?amazon\.(com|co\.uk|de|fr|ca|com\.au|co\.jp|in|com\.mx|nl|se|com\.be|com\.br|com\.tr|ae|sg|com\.sg)(\/.*)?$/i
const ASIN_RE = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join('-')
    .replace(/-+/g, '-')
}

async function generateSlug(admin: ReturnType<typeof adminClient>, productTitle: string, asin: string | null): Promise<string> {
  const base = slugify(productTitle)
  const suffix = asin ? `-${asin.slice(-6).toLowerCase()}` : ''
  let candidate = `${base}${suffix}`

  // Collision check
  let attempt = 0
  while (true) {
    const slug = attempt === 0 ? candidate : `${candidate}-${attempt + 1}`
    const { data } = await admin.from('public_geo_pages').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
    attempt++
    if (attempt > 10) return `${candidate}-${Date.now()}`
  }
}

// POST — publish or update a GEO page
export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await checkRateLimit(user.id, 'user')
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  const { data: userData } = await supabase
    .from('users')
    .select('plan, is_admin')
    .eq('id', user.id)
    .single()

  const plan    = userData?.plan || 'free'
  const isAdmin = userData?.is_admin === true

  if (!isAdmin && plan === 'free') {
    return NextResponse.json(
      { error: 'GEO pages are available on Starter, Growth, and Pro plans.', upgradeRequired: true },
      { status: 403 },
    )
  }

  const body           = await request.json()
  const reportId       = body?.reportId
  const sellerBio      = body?.sellerBio?.slice(0, 500) || null
  const amazonUrl      = body?.amazonUrl?.trim() || ''
  const showComplaints = body?.showComplaints !== false
  const showStrengths  = body?.showStrengths  !== false

  if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

  // Validate Amazon URL
  if (!amazonUrl || !AMAZON_URL_RE.test(amazonUrl)) {
    return NextResponse.json({ error: 'Invalid Amazon product URL' }, { status: 400 })
  }

  // Extract ASIN from Amazon URL
  const urlAsinMatch = amazonUrl.match(ASIN_RE)
  const urlAsin = urlAsinMatch ? urlAsinMatch[1].toUpperCase() : null

  // Fetch report
  const { data: report } = await supabase
    .from('reports')
    .select('id, user_id, product_url, product_name, health_score, full_report, asin')
    .eq('id', reportId)
    .single()

  if (!report || report.user_id !== user.id) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // Validate ASIN matches if both are available
  const reportAsin = report.asin || report.full_report?.asin
  if (urlAsin && reportAsin && urlAsin !== reportAsin.toUpperCase()) {
    return NextResponse.json(
      { error: 'Amazon URL does not match the analyzed product. Please use the correct product link.' },
      { status: 400 },
    )
  }

  const admin = adminClient()

  // Check existing page for this report
  const { data: existing } = await admin
    .from('public_geo_pages')
    .select('id, slug, view_count')
    .eq('report_id', reportId)
    .maybeSingle()

  // Plan limit check (only for new pages)
  if (!existing) {
    const planLimit = isAdmin ? Infinity : (PLAN_LIMITS[plan] ?? 0)
    const { count } = await admin
      .from('public_geo_pages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('published', true)

    if ((count ?? 0) >= planLimit) {
      const limits: Record<string, number> = { starter: 3, growth: 10 }
      return NextResponse.json(
        { error: `Your ${plan} plan allows up to ${limits[plan] ?? 3} published GEO pages. Upgrade to publish more.`, upgradeRequired: true },
        { status: 403 },
      )
    }
  }

  // Extract snapshot data from full_report
  const fr           = report.full_report || {}
  const asin         = reportAsin || urlAsin
  const marketplace  = report.product_url?.match(/amazon\.([a-z.]+)/)?.[0] || 'amazon.com'
  const complaints   = (fr.complaints || []).slice(0, 5)
  const strengths    = (fr.strengths  || []).slice(0, 5)
  const buyerPhrases = fr.seoTopPhrases || fr.buyerPhrases || []
  const starBreakdown = fr.starBreakdown || {}
  const totalReviews  = Object.values(starBreakdown as Record<string, number>).reduce((a, b) => a + b, 0)
  const avgRating     = totalReviews > 0
    ? Object.entries(starBreakdown as Record<string, number>)
        .reduce((sum, [star, count]) => sum + Number(star) * count, 0) / totalReviews
    : null

  const now = new Date().toISOString()

  if (existing) {
    // Update snapshot + prefs
    await admin.from('public_geo_pages').update({
      seller_bio:      sellerBio,
      amazon_url:      amazonUrl,
      show_complaints: showComplaints,
      show_strengths:  showStrengths,
      health_score:    report.health_score,
      product_title:   report.product_name || fr.productTitle || 'Amazon Product',
      product_image:   fr.productImage || null,
      asin,
      marketplace,
      star_breakdown:  starBreakdown,
      complaints,
      strengths,
      buyer_phrases:   buyerPhrases,
      summary:         fr.summary || null,
      total_reviews:   totalReviews,
      avg_rating:      avgRating ? Number(avgRating.toFixed(1)) : null,
      published:       true,
      published_at:    existing ? undefined : now,
      last_snapshot_at: now,
      updated_at:      now,
      plan_at_publish: plan,
    }).eq('id', existing.id)

    revalidatePath(`/product/${existing.slug}`)
    return NextResponse.json({ success: true, slug: existing.slug, pageUrl: `https://voxrate.app/product/${existing.slug}` })
  }

  // New page
  const slug = await generateSlug(admin, report.product_name || fr.productTitle || 'amazon-product', asin)

  const { error } = await admin.from('public_geo_pages').insert({
    report_id:       reportId,
    user_id:         user.id,
    slug,
    published:       true,
    seller_bio:      sellerBio,
    amazon_url:      amazonUrl,
    show_complaints: showComplaints,
    show_strengths:  showStrengths,
    health_score:    report.health_score,
    product_title:   report.product_name || fr.productTitle || 'Amazon Product',
    product_image:   fr.productImage || null,
    asin,
    marketplace,
    star_breakdown:  starBreakdown,
    complaints,
    strengths,
    buyer_phrases:   buyerPhrases,
    summary:         fr.summary || null,
    total_reviews:   totalReviews,
    avg_rating:      avgRating ? Number(avgRating.toFixed(1)) : null,
    published_at:    now,
    last_snapshot_at: now,
    plan_at_publish: plan,
  })

  if (error) {
    console.error('[GEO publish]', error.message)
    return NextResponse.json({ error: 'Failed to publish' }, { status: 500 })
  }

  revalidatePath(`/product/${slug}`)
  return NextResponse.json({ success: true, slug, pageUrl: `https://voxrate.app/product/${slug}` })
}

// DELETE — unpublish
export async function DELETE(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reportId } = await request.json()
  if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

  const admin = adminClient()
  const { data: page } = await admin
    .from('public_geo_pages')
    .select('id, slug, user_id')
    .eq('report_id', reportId)
    .maybeSingle()

  if (!page || page.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await admin.from('public_geo_pages').update({ published: false, updated_at: new Date().toISOString() }).eq('id', page.id)
  revalidatePath(`/product/${page.slug}`)
  return NextResponse.json({ success: true })
}
