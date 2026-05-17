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

        // Max credits per pack is 700 (pro_pack); max per subscription is 2000 (pro monthly)
        const MAX_PACK_CREDITS = 700
        const MAX_SUB_CREDITS  = 2000

        if (type === 'credit_pack') {
          // Add credits for one-time purchase
          const credits = parseInt(session.metadata?.credits || '0', 10)
          if (credits > 0 && credits <= MAX_PACK_CREDITS) {
            console.log(`[Webhook] Adding ${credits} credits to user ${userId} (pack)`)
            const { error: rpcError } = await supabase.rpc('add_credits', { p_user_id: userId, p_amount: credits })
            if (rpcError) {
              console.error(`[Webhook] add_credits RPC failed:`, rpcError.message)
              await supabase.from('processed_webhook_events').delete().eq('stripe_event_id', event.id)
              return NextResponse.json({ error: 'Credit update failed' }, { status: 500 })
            }
            console.log(`[Webhook] ✅ ${credits} credits added`)
          } else if (credits > MAX_PACK_CREDITS) {
            console.error(`[Webhook] Suspicious credit amount ${credits} — rejected`)
          }
        } else {
          // Subscription checkout — set plan + add initial credits
          const plan    = session.metadata?.plan
          const credits = parseInt(session.metadata?.credits || '0', 10)

          if (!plan || !['starter', 'growth', 'pro'].includes(plan)) {
            console.error('[Webhook] Invalid plan value:', plan)
            break
          }

          console.log(`[Webhook] Upgrading user ${userId} to ${plan} + ${credits} credits`)

          const { error: updateError } = await supabase.from('users').update({
            plan,
            stripe_customer_id:     session.customer as string,
            stripe_subscription_id: session.subscription as string,
          }).eq('id', userId)

          if (updateError) {
            console.error(`[Webhook] User plan update failed:`, updateError.message)
            await supabase.from('processed_webhook_events').delete().eq('stripe_event_id', event.id)
            return NextResponse.json({ error: 'Plan update failed' }, { status: 500 })
          }

          if (credits > 0 && credits <= MAX_SUB_CREDITS) {
            const { error: rpcError } = await supabase.rpc('add_credits', { p_user_id: userId, p_amount: credits })
            if (rpcError) {
              console.error(`[Webhook] add_credits RPC failed on subscription:`, rpcError.message)
              await supabase.from('processed_webhook_events').delete().eq('stripe_event_id', event.id)
              return NextResponse.json({ error: 'Credit update failed' }, { status: 500 })
            }
          } else if (credits > MAX_SUB_CREDITS) {
            console.error(`[Webhook] Suspicious subscription credit amount ${credits} — rejected`)
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
        if (!['starter', 'growth', 'pro'].includes(plan)) break

        console.log(`[Webhook] Monthly renewal for user ${userId} — adding ${credits} credits`)
        const { error: renewUpdateError } = await supabase.from('users').update({ plan }).eq('id', userId)
        if (renewUpdateError) {
          console.error(`[Webhook] Renewal plan update failed:`, renewUpdateError.message)
          await supabase.from('processed_webhook_events').delete().eq('stripe_event_id', event.id)
          return NextResponse.json({ error: 'Plan update failed' }, { status: 500 })
        }
        // On renewal: reset credits to plan amount (no rollover) + reset competitor counter
        if (credits > 0 && credits <= 2000) {
          const { error: resetError } = await supabase
            .from('users')
            .update({ credits, competitor_analyses_used: 0 })
            .eq('id', userId)
          if (resetError) {
            console.error(`[Webhook] Credit reset failed on renewal:`, resetError.message)
            await supabase.from('processed_webhook_events').delete().eq('stripe_event_id', event.id)
            return NextResponse.json({ error: 'Credit update failed' }, { status: 500 })
          }
        } else if (credits > 2000) {
          console.error(`[Webhook] Suspicious renewal credit amount ${credits} — rejected`)
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

        console.log(`[Webhook] Subscription ended for user ${userId} — downgrading to free, zeroing credits`)
        await supabase.from('users').update({ plan: 'free', credits: 0 }).eq('id', userId)
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
