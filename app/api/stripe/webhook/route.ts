// ============================================================
// STRIPE WEBHOOK — voxrate/app/api/stripe/webhook/route.ts
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/app/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

export async function POST(request: NextRequest) {
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createClient()

  // ── Idempotency check ────────────────────────────────────────
  try {
    const { error: insertError } = await supabase
      .from('processed_webhook_events')
      .insert({ stripe_event_id: event.id })

    if (insertError) {
      if (insertError.code === '23505') {
        console.log(`[Webhook] Duplicate event ${event.id} — skipping`)
        return NextResponse.json({ received: true })
      }
      // Any other idempotency failure — abort to prevent duplicate processing
      console.error('[Webhook] Idempotency check failed:', insertError.message)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
  } catch (idempotencyErr: any) {
    console.error('[Webhook] Idempotency check threw:', idempotencyErr.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  // ── Event processing ─────────────────────────────────────────
  try {
    switch (event.type) {

      // ── One-time payment OR subscription checkout ─────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId  = session.metadata?.user_id
        const type    = session.metadata?.type

        if (!userId) {
          console.error('[Webhook] Missing user_id in metadata')
          break
        }

        if (type === 'credit_pack') {
          // Add credits for one-time purchase
          const credits = parseInt(session.metadata?.credits || '0', 10)
          if (credits > 0) {
            console.log(`[Webhook] Adding ${credits} credits to user ${userId} (pack)`)
            await supabase.rpc('add_credits', { p_user_id: userId, p_amount: credits })
            console.log(`[Webhook] ✅ ${credits} credits added`)
          }
        } else {
          // Subscription checkout — set plan + add initial credits
          const plan    = session.metadata?.plan
          const credits = parseInt(session.metadata?.credits || '0', 10)

          if (!plan || !['starter', 'pro'].includes(plan)) {
            console.error('[Webhook] Invalid plan value:', plan)
            break
          }

          console.log(`[Webhook] Upgrading user ${userId} to ${plan} + ${credits} credits`)

          await supabase.from('users').update({
            plan,
            stripe_customer_id:     session.customer as string,
            stripe_subscription_id: session.subscription as string,
          }).eq('id', userId)

          if (credits > 0) {
            await supabase.rpc('add_credits', { p_user_id: userId, p_amount: credits })
          }

          console.log(`[Webhook] ✅ User ${userId} upgraded to ${plan}`)
        }
        break
      }

      // ── Subscription renewal — top up credits ─────────────────
      case 'invoice.payment_succeeded': {
        const invoice        = event.data.object as any
        const subscriptionId = invoice.subscription
        if (!subscriptionId) break

        // Only handle renewals (not initial payment — already handled above)
        if (invoice.billing_reason !== 'subscription_cycle') break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const userId  = subscription.metadata?.user_id
        const plan    = subscription.metadata?.plan
        const credits = parseInt(subscription.metadata?.credits || '0', 10)

        if (!userId || !plan) break
        if (!['starter', 'pro'].includes(plan)) break

        console.log(`[Webhook] Monthly renewal for user ${userId} — adding ${credits} credits`)
        await supabase.from('users').update({ plan }).eq('id', userId)
        if (credits > 0) {
          await supabase.rpc('add_credits', { p_user_id: userId, p_amount: credits })
        }
        break
      }

      // ── Subscription cancelled or payment failed ───────────────
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const obj            = event.data.object as any
        const subscriptionId = obj.subscription || obj.id
        if (!subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const userId = subscription.metadata?.user_id
        if (!userId) break

        console.log(`[Webhook] Subscription ended for user ${userId} — downgrading to free`)
        await supabase.from('users').update({ plan: 'free' }).eq('id', userId)
        break
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('[Webhook] Error processing event:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
