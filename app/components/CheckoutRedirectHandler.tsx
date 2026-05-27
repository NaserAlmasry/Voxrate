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

    if (!plan && !billing) return

    router.replace('/dashboard')

    const timerId = setTimeout(async () => {
      try {
        if (!plan || !billing || !['starter', 'growth', 'pro'].includes(plan) || !['monthly', 'annual'].includes(billing)) return
        const body = { plan, billing }

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
