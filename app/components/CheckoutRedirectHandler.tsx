'use client'

// ============================================================
// app/components/CheckoutRedirectHandler.tsx
// Drop this inside your dashboard/layout.tsx or dashboard/page.tsx
// It detects ?checkout=plan&billing=X and fires Stripe automatically
// ============================================================

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function CheckoutRedirectHandler() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  useEffect(() => {
    const plan    = searchParams.get('checkout')
    const billing = searchParams.get('billing')
    const pack    = searchParams.get('pack')

    // Only act when there are actual checkout params — otherwise this fires
    // on every render and causes an infinite replace → re-render loop.
    if (!plan && !billing && !pack) return

    router.replace('/dashboard')

    const timerId = setTimeout(async () => {
      try {
        let body: object | null = null

        if (pack && ['starter_pack', 'growth_pack', 'pro_pack'].includes(pack)) {
          body = { type: 'credit_pack', pack }
        } else if (plan && billing && ['starter', 'pro'].includes(plan) && ['monthly'].includes(billing)) {
          body = { type: 'subscription', plan, billing }
        }

        if (!body) return

        const response = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify(body),
        })
        const data = await response.json()
        if (response.ok && data.url) window.location.href = data.url
        else console.error('[CheckoutRedirect] Error:', data.error)
      } catch (err) {
        console.error('[CheckoutRedirect] Fetch error:', err)
      }
    }, 500)

    return () => clearTimeout(timerId)
  }, [searchParams, router])

  return null // invisible component, no UI
}
