// ============================================================
// STRIPE CHECKOUT — voxrate/app/api/stripe/checkout/route.ts
// Creates a Stripe checkout session and returns the URL
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/app/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

const PRICE_IDS = {
  starter_monthly: 'price_1TQ8lF3cC2yqvyfuajzh2Q1T',
  starter_annual:  'price_1TQ8lF3cC2yqvyfuCkaGS5UW',
  pro_monthly:     'price_1TQ8oE3cC2yqvyfuG5igyJoh',
  pro_annual:      'price_1TQ8oi3cC2yqvyfuNO5Ypyyt',
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Please log in first' }, { status: 401 })
    }

    const body = await request.json()
    const { plan, billing } = body

    const key = `${plan}_${billing}` as keyof typeof PRICE_IDS
    const priceId = PRICE_IDS[key]
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
    }

    const origin = request.headers.get('origin') || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded=true`,
      cancel_url: `${origin}/#pricing`,
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        plan,
        billing,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
          billing,
        },
      },
    })

    return NextResponse.json({ url: session.url })

  } catch (error: any) {
    console.error('[Stripe Checkout] Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create checkout session' }, { status: 500 })
  }
}