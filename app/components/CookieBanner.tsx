'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('cookie_consent')) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem('cookie_consent', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-900 text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
      <p className="text-neutral-300 leading-relaxed max-w-2xl">
        Voxrate uses cookies strictly for authentication and session management. No tracking or advertising cookies are used.{' '}
        <Link href="/privacy" className="underline text-white hover:text-orange-400 transition-colors">
          Privacy Policy
        </Link>
      </p>
      <button
        onClick={dismiss}
        className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
      >
        Got it
      </button>
    </div>
  )
}
