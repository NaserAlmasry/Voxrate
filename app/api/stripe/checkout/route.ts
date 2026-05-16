// ============================================================
// STRIPE CHECKOUT — voxrate/app/api/stripe/checkout/route.ts
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/app/lib/supabase/server'
import { checkCsrf } from '@/app/lib/csrf'
import { checkRateLimit } from '@/app/lib/rate-limit'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

// ── Subscription price IDs ────────────────────────────────────
const SUBSCRIPTION_PRICE_IDS: Record<string, string> = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY!,
  growth_monthly:  process.env.STRIPE_PRICE_GROWTH_MONTHLY!,
  pro_monthly:     process.env.STRIPE_PRICE_PRO_MONTHLY!,
}

const SUBSCRIPTION_CREDITS: Record<string, number> = {
  starter: 300,
  growth:  800,
  pro:     2000,
}

const CREDIT_PACK_PRICE_IDS: Record<string, string> = {
  starter_pack: process.env.STRIPE_PRICE_STARTER_PACK!,
  growth_pack:  process.env.STRIPE_PRICE_GROWTH_PACK!,
  pro_pack:     process.env.STRIPE_PRICE_PRO_PACK!,
}

const CREDIT_PACK_AMOUNTS: Record<string, number> = {
  starter_pack: 100,
  growth_pack:  300,
  pro_pack:     700,
}

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Please log in first' }, { status: 401 })
    }

    const limit = await checkRateLimit(`checkout:${user.id}`, 'user')
    if (!limit.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

    const body = await request.json()
    const { type, plan, billing, pack } = body

    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
    const window = Math.floor(Date.now() / 60000)

    // ── Credit pack (one-time payment) ────────────────────────
    if (type === 'credit_pack') {
      if (!pack || !CREDIT_PACK_PRICE_IDS[pack]) {
        return NextResponse.json({ error: 'Invalid credit pack selected' }, { status: 400 })
      }

      const idempotencyKey = `creditpack_${user.id}_${pack}_${window}`

      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [{ price: CREDIT_PACK_PRICE_IDS[pack], quantity: 1 }],
          success_url: `${SITE_URL}/dashboard?upgraded=true`,
          cancel_url:  `${SITE_URL}/#pricing`,
          customer_email: user.email,
          metadata: {
            user_id:     user.id,
            type:        'credit_pack',
            pack,
            credits:     String(CREDIT_PACK_AMOUNTS[pack]),
          },
        },
        { idempotencyKey },
      )

      return NextResponse.json({ url: session.url })
    }

    // ── Subscription ──────────────────────────────────────────
    const billingMode = billing || 'monthly'
    if (!['starter', 'growth', 'pro'].includes(plan) || !['monthly'].includes(billingMode)) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
    }

    const key = `${plan}_${billingMode}`
    const priceId = SUBSCRIPTION_PRICE_IDS[key]
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
    }

    const subscriptionCredits = SUBSCRIPTION_CREDITS[plan] ?? 300
    const idempotencyKey = `checkout_${user.id}_${plan}_${billingMode}_${window}`

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${SITE_URL}/dashboard?upgraded=true`,
        cancel_url:  `${SITE_URL}/#pricing`,
        customer_email: user.email,
        metadata: {
          user_id: user.id,
          type:    'subscription',
          plan,
          billing: billingMode,
          credits: String(subscriptionCredits),
        },
        subscription_data: {
          metadata: {
            user_id: user.id,
            plan,
            billing: billingMode,
            credits: String(subscriptionCredits),
          },
        },
      },
      { idempotencyKey },
    )

    return NextResponse.json({ url: session.url })

  } catch (error: any) {
    console.error('[Stripe Checkout] Error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
