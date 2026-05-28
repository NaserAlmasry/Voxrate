'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Analytics } from '@vercel/analytics/next'

type Consent = 'accepted' | 'declined' | null

export default function CookieBanner() {
  const [consent, setConsent] = useState<Consent>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('cookie_consent') as Consent | null
    if (stored) {
      setConsent(stored)
    } else {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem('cookie_consent', 'accepted')
    setConsent('accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem('cookie_consent', 'declined')
    setConsent('declined')
    setVisible(false)
  }

  return (
    <>
      {consent === 'accepted' && <Analytics />}

      {visible && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-900 text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm shadow-2xl">
          <p className="text-neutral-300 leading-relaxed max-w-2xl">
            We use cookies for authentication (required to log in) and anonymous usage analytics to improve the product. No advertising or tracking cookies are used.{' '}
            <Link href="/privacy" className="underline text-white hover:text-orange-400 transition-colors">
              Privacy Policy
            </Link>
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={decline}
              className="px-4 py-2 rounded-lg border border-neutral-600 text-neutral-300 hover:text-white hover:border-neutral-400 transition-colors whitespace-nowrap font-medium"
            >
              Decline analytics
            </button>
            <button
              onClick={accept}
              className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors whitespace-nowrap"
            >
              Accept all
            </button>
          </div>
        </div>
      )}
    </>
  )
}
