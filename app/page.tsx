'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import AuthModal from '@/app/components/AuthModal'
import Navbar from '@/app/components/sections/Navbar'
import HeroSection from '@/app/components/sections/HeroSection'
import SocialProofStrip from '@/app/components/sections/SocialProofStrip'
import DemoSection from '@/app/components/sections/DemoSection'
import SocialProofSection from '@/app/components/sections/SocialProofSection'
import FeaturesSection from '@/app/components/sections/FeaturesSection'
import HowItWorksSection from '@/app/components/sections/HowItWorksSection'
import ComparisonSection from '@/app/components/sections/ComparisonSection'
import PricingSection from '@/app/components/sections/PricingSection'
import BeforeAfterSection from '@/app/components/sections/BeforeAfterSection'
import WhoIsThisForSection from '@/app/components/sections/WhoIsThisForSection'
import SeoTextSection from '@/app/components/sections/SeoTextSection'
import FaqSection from '@/app/components/sections/FaqSection'
import FinalCtaSection from '@/app/components/sections/FinalCtaSection'
import FooterTrustBar from '@/app/components/sections/FooterTrustBar'
import FooterSection from '@/app/components/sections/FooterSection'
export default function LandingPage() {
  const [heroUrl, setHeroUrl]         = useState('')
  const [heroUrlError, setHeroUrlError] = useState('')
  const [ctaUrl, setCtaUrl]           = useState('')
  const [ctaUrlError, setCtaUrlError] = useState('')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<{ step?: 'plan' | 'auth'; authMode?: 'signup' | 'login' }>({})
  const [showNewsletter, setShowNewsletter] = useState(false)
  const [nlEmail, setNlEmail]         = useState('')
  const [nlSubmitted, setNlSubmitted] = useState(false)
  const [nlError, setNlError]         = useState(false)
  const [activeTab, setActiveTab]     = useState('complaints')
  const [expandedComplaint, setExpandedComplaint] = useState<number | null>(0)
  const [compExpandedComplaint, setCompExpandedComplaint] = useState<number | null>(0)
  const [footerNlEmail, setFooterNlEmail]   = useState('')
  const [footerNlSubmitted, setFooterNlSubmitted] = useState(false)
  const [calcProducts, setCalcProducts] = useState(5)
  const [calcFrequency, setCalcFrequency] = useState<'monthly' | 'quarterly'>('monthly')
  const nlDropdownRef = useRef<HTMLDivElement>(null)
  const [supabase] = useState(() => createClient())
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Capture ?ref=CODE so we can credit the referrer after this visitor signs up
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const ref = params.get('ref')
      if (ref && /^[A-Za-z0-9_-]{1,32}$/.test(ref)) {
        localStorage.setItem('voxrate_ref_code', ref)
        const existing = document.cookie.split('; ').find(c => c.startsWith('voxrate_ref='))
        if (!existing) {
          const maxAge = 90 * 24 * 60 * 60
          document.cookie = `voxrate_ref=${ref}; Max-Age=${maxAge}; Path=/; SameSite=Lax`
          fetch('/api/ambassador/track-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referralCode: ref }),
          }).catch(() => {})
        }
      }
    } catch {}
  }, [])

  // Check if user is already logged in to show dashboard button
  // Also: if arriving via ?from=ext (Chrome extension "Open Voxrate" button),
  // redirect paid users → /dashboard, free/unregistered → #pricing
  useEffect(() => {
    const fromExt = new URLSearchParams(window.location.search).get('from') === 'ext'
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setIsLoggedIn(true)
        if (fromExt) {
          const { data: userData } = await supabase
            .from('users')
            .select('plan')
            .eq('id', user.id)
            .single()
          if (userData?.plan && userData.plan !== 'free') {
            window.location.href = '/dashboard'
          } else {
            window.location.hash = 'pricing'
          }
        }
      } else if (fromExt) {
        window.location.hash = 'pricing'
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Show "account verified" banner if redirected here with ?verified=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('verified') === 'true') {
      setShowVerifiedBanner(true)
      // Clean the param from the URL without a page reload
      const cleanUrl = window.location.pathname + (window.location.hash || '')
      window.history.replaceState(null, '', cleanUrl)
      // Auto-dismiss after 6 seconds
      const t = setTimeout(() => setShowVerifiedBanner(false), 6000)
      return () => clearTimeout(t)
    }
  }, [])

  const saveNewsletter = async (email: string) => {
    try { await supabase.from('newsletter_emails').insert({ email }) } catch {}
  }

  useEffect(() => {
    const els = document.querySelectorAll('.scroll-fade, .scroll-fade-group')
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } })
    }, { threshold: 0.1 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!showNewsletter) return
    const handler = (e: MouseEvent) => {
      if (nlDropdownRef.current && !nlDropdownRef.current.contains(e.target as Node)) setShowNewsletter(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNewsletter])

  const signIn = useCallback(async (url: string, requireUrl = false) => {
    if (requireUrl) {
      if (!url.trim()) return { error: 'Please paste an Amazon product URL or ASIN first' }
      if (!url.includes('amazon.com') && !/^[A-Z0-9]{10}$/i.test(url.trim())) return { error: 'Please paste a valid Amazon URL or ASIN' }
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (requireUrl) {
      try { localStorage.setItem('pendingUrl', url) } catch { return { error: 'Browser storage unavailable. Please enable cookies.' } }
    }
    if (user) { window.location.href = '/dashboard'; return { error: null } }
    // Not logged in — show auth modal with plan picker so user signs up properly
    setAuthModalMode({ step: 'plan' })
    setShowAuthModal(true)
    return { error: null }
  }, [supabase])

  const analyzeHero = async () => { const r = await signIn(heroUrl, true); if (r?.error) setHeroUrlError(r.error) }
  const analyzeCta  = async () => { const r = await signIn(ctaUrl,  true); if (r?.error) setCtaUrlError(r.error) }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-neutral-900" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      {showAuthModal && (
        <AuthModal
          onClose={() => { setShowAuthModal(false); setAuthModalMode({}) }}
          initialStep={authModalMode.step}
          initialAuthMode={authModalMode.authMode}
        />
      )}

      {/* ── Email verified banner ── */}
      {showVerifiedBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3.5 bg-green-600 text-white text-sm font-medium rounded-2xl shadow-xl">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Your account has been verified. You can now sign in.
          <button onClick={() => setShowVerifiedBanner(false)} className="ml-2 opacity-70 hover:opacity-100 transition-opacity" aria-label="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
      <style>{`
        html { scroll-behavior: smooth; }
        .bdg:hover .bdot { animation: blink 1.1s ease infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.1} }
        .ndrop { animation: ndwn 0.18s ease forwards; }
        @keyframes ndwn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .hero-fade { animation: herofade 0.8s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes herofade { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .step-connector { background: linear-gradient(90deg, #f05a1e, #fb923c); }
      `}</style>

      <Navbar
        isLoggedIn={isLoggedIn}
        showNewsletter={showNewsletter} setShowNewsletter={setShowNewsletter}
        nlDropdownRef={nlDropdownRef}
        nlEmail={nlEmail} setNlEmail={setNlEmail}
        nlError={nlError} setNlError={setNlError}
        nlSubmitted={nlSubmitted} setNlSubmitted={setNlSubmitted}
        saveNewsletter={saveNewsletter}
        openLogin={() => { setAuthModalMode({ step: 'auth', authMode: 'login' }); setShowAuthModal(true) }}
        openSignup={() => setShowAuthModal(true)}
      />

      <HeroSection
        heroUrl={heroUrl} heroUrlError={heroUrlError}
        setHeroUrl={setHeroUrl} setHeroUrlError={setHeroUrlError}
        analyzeHero={analyzeHero}
      />

      <SocialProofStrip />

      <DemoSection
        activeTab={activeTab} setActiveTab={setActiveTab}
        expandedComplaint={expandedComplaint} setExpandedComplaint={setExpandedComplaint}
        compExpandedComplaint={compExpandedComplaint} setCompExpandedComplaint={setCompExpandedComplaint}
      />

      <SocialProofSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ComparisonSection />

      <PricingSection
        billingCycle={billingCycle} setBillingCycle={setBillingCycle}
        calcProducts={calcProducts} setCalcProducts={setCalcProducts}
        calcFrequency={calcFrequency} setCalcFrequency={setCalcFrequency}
        openAuthModal={() => setShowAuthModal(true)}
      />

      <BeforeAfterSection />
      <WhoIsThisForSection />
      <SeoTextSection />
      <FaqSection />

      <FinalCtaSection
        ctaUrl={ctaUrl} ctaUrlError={ctaUrlError}
        setCtaUrl={setCtaUrl} setCtaUrlError={setCtaUrlError}
        analyzeCta={analyzeCta}
      />

      <FooterTrustBar />

      <FooterSection
        footerNlEmail={footerNlEmail} setFooterNlEmail={setFooterNlEmail}
        footerNlSubmitted={footerNlSubmitted} setFooterNlSubmitted={setFooterNlSubmitted}
        saveNewsletter={saveNewsletter}
      />

    </div>
  )
}
