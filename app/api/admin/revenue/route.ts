import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

type PlanKey = 'starter' | 'growth' | 'pro'

export type RevenueResponse = {
  mrr: number
  newThisMonth: number
  churnedThisMonth: number
  byPlan: Record<PlanKey, { count: number; mrr: number }>
  totalActive: number
}

// Map Stripe price amount (in cents, monthly-normalized) to a plan bucket.
// Adjust thresholds if pricing changes.
function planFromAmount(monthlyCents: number): PlanKey | null {
  if (monthlyCents <= 0) return null
  if (monthlyCents < 2500) return 'starter'   // < $25
  if (monthlyCents < 6000) return 'growth'    // $25–$59
  return 'pro'                                 // >= $60
}

// Try metadata/nickname first, fall back to amount-based bucket.
function detectPlan(sub: Stripe.Subscription, monthlyCents: number): PlanKey | null {
  const item = sub.items.data[0]
  const price = item?.price
  const nick  = (price?.nickname || '').toLowerCase()
  const meta  = (price?.metadata?.plan || sub.metadata?.plan || '').toLowerCase()
  const hay   = `${nick} ${meta}`
  if (hay.includes('starter')) return 'starter'
  if (hay.includes('growth'))  return 'growth'
  if (hay.includes('pro'))     return 'pro'
  return planFromAmount(monthlyCents)
}

function monthlyCentsFor(sub: Stripe.Subscription): number {
  let total = 0
  for (const item of sub.items.data) {
    const price = item.price
    const qty   = item.quantity ?? 1
    const unit  = price?.unit_amount ?? 0
    const interval      = price?.recurring?.interval ?? 'month'
    const intervalCount = price?.recurring?.interval_count ?? 1
    // Normalize to monthly
    let monthly = unit * qty
    if (interval === 'year')  monthly = monthly / (12 * intervalCount)
    if (interval === 'week')  monthly = (monthly * 52) / 12 / intervalCount
    if (interval === 'day')   monthly = (monthly * 365) / 12 / intervalCount
    if (interval === 'month') monthly = monthly / intervalCount
    total += monthly
  }
  return total
}

async function listAll(
  stripe: Stripe,
  params: Stripe.SubscriptionListParams,
): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = []
  let starting_after: string | undefined
  // Cap pages to avoid runaway loops
  for (let i = 0; i < 50; i++) {
    const page = await stripe.subscriptions.list({ ...params, limit: 100, starting_after })
    out.push(...page.data)
    if (!page.has_more) break
    starting_after = page.data[page.data.length - 1]?.id
    if (!starting_after) break
  }
  return out
}

export async function GET() {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me, error: meErr } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (meErr) { console.error('[Revenue] admin check failed:', meErr.message); return NextResponse.json({ error: meErr.message }, { status: 500 }) }
  if (!me?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

  const stripe = new Stripe(secret)

  const now   = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime() / 1000
  const monthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).getTime() / 1000

  const [active, canceled] = await Promise.all([
    listAll(stripe, { status: 'active' }),
    listAll(stripe, { status: 'canceled', created: { gte: Math.floor(monthStart) - 60 * 60 * 24 * 90 } }),
  ]).catch((err: any) => {
    console.error('[Revenue] Stripe fetch failed:', err?.message ?? err)
    throw err
  })

  const byPlan: Record<PlanKey, { count: number; mrr: number }> = {
    starter: { count: 0, mrr: 0 },
    growth:  { count: 0, mrr: 0 },
    pro:     { count: 0, mrr: 0 },
  }

  let mrrCents = 0
  let newThisMonth = 0

  for (const sub of active) {
    const monthlyCents = monthlyCentsFor(sub)
    mrrCents += monthlyCents
    if (sub.created >= monthStart && sub.created < monthEnd) newThisMonth += 1
    const plan = detectPlan(sub, monthlyCents)
    if (plan) {
      byPlan[plan].count += 1
      byPlan[plan].mrr   += monthlyCents / 100
    }
  }

  let churnedThisMonth = 0
  for (const sub of canceled) {
    const ts = sub.canceled_at ?? sub.ended_at ?? 0
    if (ts >= monthStart && ts < monthEnd) churnedThisMonth += 1
  }

  const payload: RevenueResponse = {
    mrr: mrrCents / 100,
    newThisMonth,
    churnedThisMonth,
    byPlan,
    totalActive: active.length,
  }

  return NextResponse.json(payload)
  } catch (err: any) {
    console.error('[Revenue] Unhandled error:', err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}
