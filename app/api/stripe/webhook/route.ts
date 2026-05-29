// ============================================================
// STRIPE WEBHOOK — voxrate/app/api/stripe/webhook/route.ts
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { PLAN_ANALYSES } from '@/app/lib/credit-costs'

let _stripe: Stripe | null = null
const getStripe = () => _stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any })

export async function POST(request: NextRequest) {
  const stripe = getStripe()
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

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── Idempotency check ────────────────────────────────────────
  // NOTE: Add `processed boolean default false` column to processed_webhook_events
  // table for full idempotency. Falls back to insert-only check if absent.
  let useProcessedFlag = true
  try {
    const { data: existingEvent, error: selectError } = await supabase
      .from('processed_webhook_events')
      .select('processed')
      .eq('stripe_event_id', event.id)
      .maybeSingle()

    if (selectError && /column .* does not exist/i.test(selectError.message || '')) {
      useProcessedFlag = false
    } else if (existingEvent?.processed === true) {
      console.log(`[Webhook] Event ${event.id} already processed — skipping`)
      return NextResponse.json({ received: true })
    }

    if (useProcessedFlag) {
      const { error: upsertError } = await supabase
        .from('processed_webhook_events')
        .upsert({ stripe_event_id: event.id, processed: false }, { onConflict: 'stripe_event_id' })
      if (upsertError && /column .* does not exist/i.test(upsertError.message || '')) {
        useProcessedFlag = false
      } else if (upsertError) {
        console.error('[Webhook] Idempotency upsert failed:', upsertError.message)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
      }
    }

    if (!useProcessedFlag) {
      const { error: insertError } = await supabase
        .from('processed_webhook_events')
        .insert({ stripe_event_id: event.id })
      if (insertError) {
        if (insertError.code === '23505') {
          console.log(`[Webhook] Duplicate event ${event.id} — skipping`)
          return NextResponse.json({ received: true })
        }
        console.error('[Webhook] Idempotency check failed:', insertError.message)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
      }
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

        const KNOWN_TYPES = ['credit_pack', 'subscription', 'upgrade']
        if (type && !KNOWN_TYPES.includes(type)) {
          console.error('[Webhook] Unknown type in metadata:', type)
          break
        }

        const KNOWN_PLANS = ['free', 'starter', 'growth', 'pro', 'enterprise']
        const planMeta = session.metadata?.plan
        if (planMeta && !KNOWN_PLANS.includes(planMeta)) {
          console.error('[Webhook] Unknown plan in metadata:', planMeta)
          break
        }

        if (type === 'credit_pack') {
          // Credit packs have been removed — reject and log
          console.error('[Webhook] credit_pack type received but feature is removed — ignoring')
          break
        }

        {
          // Subscription checkout — set plan + grant initial analyses
          const plan = session.metadata?.plan

          if (!plan || !['starter', 'growth', 'pro'].includes(plan)) {
            console.error('[Webhook] Invalid plan value:', plan)
            break
          }

            const PLAN_ANALYSES_MAP: Record<string, { own: number; competitor: number; rolloverCap: number }> = {
            starter: PLAN_ANALYSES.starter,
            growth:  PLAN_ANALYSES.growth,
            pro:     PLAN_ANALYSES.pro,
          }
          const planAllotment = PLAN_ANALYSES_MAP[plan] ?? PLAN_ANALYSES_MAP.starter

          console.log(`[Webhook] Upgrading user ${userId} to ${plan} — granting ${planAllotment.own} own + ${planAllotment.competitor} competitor analyses`)

          // Fetch subscription to get billing period end date
          let periodEnd: number | null = null
          try {
            if (session.subscription) {
              const sub = await stripe.subscriptions.retrieve(session.subscription as string)
              periodEnd = (sub as any).current_period_end ?? null
            }
          } catch {}

          const { error: updateError } = await supabase.from('users').update({
            plan,
            stripe_customer_id:          session.customer as string,
            stripe_subscription_id:      session.subscription as string,
            stripe_current_period_end:   periodEnd,
          }).eq('id', userId)

          if (updateError) {
            // BUG 7 fix: do NOT delete the idempotency row on failure — log and return error
            // so retries are blocked and the issue requires manual intervention.
            console.error(`[Webhook] User plan update failed — MANUAL REVIEW NEEDED:`, updateError.message)
            return NextResponse.json({ error: 'Plan update failed' }, { status: 500 })
          }

          // Set analyses remaining (initial checkout: just SET, don't increment — BUG 7: use SET not INCREMENT)
          const { error: rpcError } = await supabase.from('users').update({
            own_analyses_remaining:        planAllotment.own,
            competitor_analyses_remaining: planAllotment.competitor,
          }).eq('id', userId)
          if (rpcError) {
            // BUG 7 fix: do NOT delete idempotency row — log for manual resolution
            console.error(`[Webhook] analyses update failed on subscription — MANUAL REVIEW NEEDED:`, rpcError.message)
            return NextResponse.json({ error: 'Analyses update failed' }, { status: 500 })
          }

          console.log(`[Webhook] ✅ User ${userId} upgraded to ${plan}`)

          // ── Referral conversion ──────────────────────────────
          // If this user was referred, mark the referral converted and bump
          // the referrer's counter. First paid checkout only.
          try {
            const { data: referral } = await supabase
              .from('referrals')
              .select('referrer_id, converted')
              .eq('referred_user_id', userId)
              .maybeSingle()

            if (referral && !referral.converted) {
              await supabase
                .from('referrals')
                .update({ converted: true, converted_at: new Date().toISOString() })
                .eq('referred_user_id', userId)
              const { error: rpcErr } = await supabase.rpc('increment_referral_count', { uid: referral.referrer_id })
              if (rpcErr) {
                console.error('[Webhook] increment_referral_count failed:', rpcErr.message)
              } else {
                console.log(`[Webhook] ✅ Referral converted — referrer ${referral.referrer_id} counter +1`)
              }
            }
          } catch (refErr: any) {
            // Non-fatal — never block the checkout flow because of referral bookkeeping
            console.warn('[Webhook] Referral conversion side-effect failed:', refErr?.message ?? refErr)
          }
        }
        break
      }

      // ── Subscription renewal — top up credits ─────────────────
      case 'invoice.payment_succeeded': {
        const invoice        = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as any).subscription
        if (!subscriptionId) break

        // Only handle renewals (not initial payment — already handled above)
        if (invoice.billing_reason !== 'subscription_cycle') break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const userId  = subscription.metadata?.user_id
        const plan    = subscription.metadata?.plan

        if (!userId || !plan) break
        if (!['starter', 'growth', 'pro'].includes(plan)) break

        const allotment = PLAN_ANALYSES[plan as keyof typeof PLAN_ANALYSES] ?? PLAN_ANALYSES.starter

        const periodEnd = (subscription as any).current_period_end ?? null
        console.log(`[Webhook] Monthly renewal for user ${userId} — rolling over ${allotment.own} own + ${allotment.competitor} competitor analyses (cap ${allotment.rolloverCap}x)`)

        // Rollover: add monthly allotment to remaining, cap at rolloverCap × monthly
        const { error: rolloverError } = await supabase.rpc('renew_analyses_with_rollover', {
          p_user_id:            userId,
          p_own_monthly:        allotment.own,
          p_competitor_monthly: allotment.competitor,
          p_rollover_cap:       allotment.rolloverCap,
        })

        if (rolloverError) {
          console.error(`[Webhook] Rollover RPC failed on renewal — MANUAL REVIEW NEEDED:`, rolloverError.message)
          return NextResponse.json({ error: 'Analyses rollover failed' }, { status: 500 })
        }

        const { error: renewUpdateError } = await supabase.from('users').update({ plan, stripe_current_period_end: periodEnd }).eq('id', userId)
        if (renewUpdateError) {
          console.error(`[Webhook] Renewal plan update failed — MANUAL REVIEW NEEDED:`, renewUpdateError.message)
          return NextResponse.json({ error: 'Plan update failed' }, { status: 500 })
        }

        // Reset emergency re-analyze override — non-fatal
        try { await supabase.rpc('reset_reanalyze_override', { p_user_id: userId }) } catch (_) {}
        console.log(`[Webhook] ✅ Rollover applied for user ${userId} on plan ${plan}`)
        break
      }

      // ── Subscription updated (plan change, cancellation scheduled) ──
      case 'customer.subscription.updated': {
        const sub    = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.user_id
        if (!userId) break
        const periodEnd = (sub as any).current_period_end ?? null
        const newPlan = sub.metadata?.plan
        const updatePayload: any = { stripe_current_period_end: periodEnd }
        if (newPlan && ['starter','growth','pro'].includes(newPlan)) {
          updatePayload.plan = newPlan
        }
        await supabase.from('users').update(updatePayload).eq('id', userId)
        break
      }

      // ── Subscription fully cancelled ──────────────────────────
      case 'customer.subscription.deleted': {
        const obj            = event.data.object as Stripe.Subscription
        const subscriptionId = obj.id
        if (!subscriptionId) break

        // Use metadata from the event object directly; only retrieve from Stripe as fallback
        let userId = obj.metadata?.user_id as string | undefined
        if (!userId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            userId = subscription.metadata?.user_id
          } catch (retrieveErr: any) {
            console.error('[Webhook] Could not retrieve subscription for deleted event:', retrieveErr.message)
          }
        }
        if (!userId) break

        console.log(`[Webhook] Subscription cancelled for user ${userId} — downgrading to free`)
        await supabase.from('users').update({
          plan:                          'free',
          own_analyses_remaining:        PLAN_ANALYSES.free.own,
          competitor_analyses_remaining: PLAN_ANALYSES.free.competitor,
          stripe_current_period_end:     null,
        }).eq('id', userId)
        break
      }

      // ── Payment failed — do NOT downgrade yet (Stripe handles dunning) ────
      // Downgrade only fires on customer.subscription.deleted (after dunning exhausted).
      // Zeroing credits here would wipe legitimately purchased credit packs on a
      // single failed payment.
      case 'invoice.payment_failed': {
        const obj            = event.data.object as Stripe.Invoice
        const subscriptionId = (obj as any).subscription
        if (!subscriptionId) break
        console.log(`[Webhook] Payment failed for subscription ${subscriptionId} — awaiting Stripe dunning`)
        break
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event.type}`)
    }

    if (useProcessedFlag) {
      await supabase
        .from('processed_webhook_events')
        .update({ processed: true })
        .eq('stripe_event_id', event.id)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('[Webhook] Error processing event:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
