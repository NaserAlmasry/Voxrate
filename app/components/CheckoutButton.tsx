'use client'

import { useState } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useToast } from '@/app/components/Toast'

interface CheckoutButtonProps {
  plan?: 'starter' | 'growth' | 'pro'
  billing?: 'monthly' | 'annual'
  pack?: 'starter_pack' | 'growth_pack' | 'pro_pack'
  label: string
  className?: string
}

export default function CheckoutButton({ plan, billing, pack, label, className }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const toast    = useToast()

  const handleClick = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        const params = pack
          ? `pendingPack=${pack}`
          : `pendingPlan=${plan}&pendingBilling=${billing}`
        const redirectTo = `${window.location.origin}/auth/callback?${params}`
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            queryParams: { access_type: 'offline', prompt: 'consent' },
          },
        })
        return
      }

      if (pack) {
        await startCreditPackCheckout(pack)
      } else if (plan && billing) {
        await startCheckout(plan, billing)
      }
    } catch (error: any) {
      console.error('[Checkout] Error:', error)
      toast(error?.message || 'Something went wrong. Please try again.', 'error')
      setLoading(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} className={className}>
      {loading ? 'Loading...' : label}
    </button>
  )
}

export async function startCheckout(plan: string, billing: string) {
  const response = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ type: 'subscription', plan, billing }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Something went wrong.')
  window.location.href = data.url
}

export async function startCreditPackCheckout(pack: string) {
  const response = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ type: 'credit_pack', pack }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Something went wrong.')
  window.location.href = data.url
}
