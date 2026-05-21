'use client'

import Link from 'next/link'
import { RefObject } from 'react'

type Props = {
  isLoggedIn: boolean
  showNewsletter: boolean
  setShowNewsletter: (v: boolean | ((p: boolean) => boolean)) => void
  nlDropdownRef: RefObject<HTMLDivElement | null>
  nlEmail: string
  setNlEmail: (v: string) => void
  nlError: boolean
  setNlError: (v: boolean) => void
  nlSubmitted: boolean
  setNlSubmitted: (v: boolean) => void
  saveNewsletter: (email: string) => Promise<void>
  openLogin: () => void
  openSignup: () => void
}

export default function Navbar({
  isLoggedIn, showNewsletter, setShowNewsletter, nlDropdownRef,
  nlEmail, setNlEmail, nlError, setNlError, nlSubmitted, setNlSubmitted,
  saveNewsletter, openLogin, openSignup,
}: Props) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-[#FAF9F6]/85 backdrop-blur-lg border-b border-neutral-200/60">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/"><img src="/logo.png" alt="Voxrate" height={36} style={{ objectFit: 'contain', maxWidth: 160 }} /></Link>
        <div className="hidden md:flex items-center gap-7 text-sm text-neutral-600">
          <a href="#features"    className="hover:text-black transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-black transition-colors">How it works</a>
          <a href="#pricing"     className="hover:text-black transition-colors">Pricing</a>
          <Link href="/blog"     className="hover:text-black transition-colors">Blog</Link>
          <div className="relative" ref={nlDropdownRef}>
            <button onClick={() => setShowNewsletter(v => !v)} className="hover:text-black transition-colors">Newsletter</button>
            {showNewsletter && (
              <div className="ndrop absolute top-9 left-1/2 -translate-x-1/2 w-72 bg-white border border-neutral-200 rounded-2xl p-4 shadow-xl z-10">
                {nlSubmitted ? (
                  <p className="text-sm text-green-600 font-medium text-center py-2">Thanks! We&apos;ll be in touch.</p>
                ) : (
                  <>
                    <p className="text-xs text-neutral-500 mb-3">Get notified about new features and exclusive discounts</p>
                    <div className="flex gap-2">
                      <input type="email" value={nlEmail} onChange={e => { setNlEmail(e.target.value); setNlError(false) }}
                        placeholder="your@email.com"
                        className={`flex-1 px-3 py-2 text-sm border rounded-lg outline-none focus:border-orange-400 transition-colors ${nlError ? 'border-red-300 bg-red-50' : 'border-neutral-200'}`} />
                      <button onClick={async () => {
                        if (!nlEmail || !nlEmail.includes('@') || !nlEmail.includes('.')) { setNlError(true); return }
                        await saveNewsletter(nlEmail); setNlSubmitted(true); setNlEmail('')
                        setTimeout(() => { setShowNewsletter(false); setNlSubmitted(false) }, 2500)
                      }} className="px-3 py-2 text-xs font-medium bg-black text-white rounded-lg hover:bg-neutral-700 transition-colors">Join</button>
                    </div>
                    {nlError && <p className="text-xs text-red-500 mt-1.5">Please enter a valid email</p>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <a href="/dashboard" className="glow-orange btn-press px-5 py-2.5 text-sm font-semibold rounded-full bg-orange-500 text-white hover:bg-orange-600 shadow-sm">
              Go to dashboard →
            </a>
          ) : (
            <>
              <button onClick={openLogin}
                className="text-sm text-neutral-600 hover:text-black transition-colors bg-transparent border-none cursor-pointer p-0">Login</button>
              <button onClick={openSignup}
                className="glow-orange btn-press px-5 py-2.5 text-sm font-semibold rounded-full bg-orange-500 text-white hover:bg-orange-600 shadow-sm">
                Start free →
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
