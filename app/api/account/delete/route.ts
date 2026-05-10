import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/app/lib/supabase/server'
import { checkCsrf } from '@/app/lib/csrf'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    // Cancel active Stripe subscriptions
    if (userData?.stripe_customer_id) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: userData.stripe_customer_id,
          status: 'active',
        })
        await Promise.all(
          subscriptions.data.map(sub =>
            stripe.subscriptions.cancel(sub.id)
          )
        )
      } catch (stripeErr: any) {
        console.error('[DeleteAccount] Stripe cancel error:', stripeErr.message)
      }
    }

    // Soft-delete: mark plan as deleted + timestamp. A cleanup job purges after 30 days.
    await supabase
      .from('users')
      .update({ plan: 'deleted', analyses_count: -1, deleted_at: new Date().toISOString() })
      .eq('id', user.id)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[DeleteAccount] Error:', error.message)
    return NextResponse.json({ error: 'Failed to delete account. Please contact support.' }, { status: 500 })
  }
}
