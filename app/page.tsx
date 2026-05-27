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
import ProductInfoModal from '@/app/components/sections/ProductInfoModal'

const googleOAuthOptions = (origin: string) => ({
  redirectTo: `${origin}/auth/callback`,
  queryParams: { access_type: 'offline', prompt: 'consent' },
})

function CsvGuide({ show, onToggle, onClose }: { show: boolean; onToggle: () => void; onClose: () => void }) {
  return (
    <div className="relative inline-block">
      <button onClick={onToggle} className="text-xs text-orange-500 hover:text-orange-600 underline underline-offset-2 transition-colors">
        How to export from Amazon?
      </button>
      {show && (
        <div className="absolute right-0 top-6 z-50 w-64 bg-black text-white text-xs rounded-xl p-4 shadow-xl">
          <div className="absolute -top-1.5 right-4 w-3 h-3 bg-black rotate-45" />
          <p className="font-semibold mb-2">Export your reviews from Amazon:</p>
          <ol className="space-y-1.5 text-neutral-300">
            <li className="flex gap-2"><span className="text-orange-400 font-bold flex-shrink-0">1.</span>Use a tool like <strong className="text-white">Helium 10</strong> or <strong className="text-white">Jungle Scout</strong> to export reviews as CSV</li>
            <li className="flex gap-2"><span className="text-orange-400 font-bold flex-shrink-0">2.</span>Or use Amazon's <strong className="text-white">Request My Data</strong> feature in your account settings</li>
            <li className="flex gap-2"><span className="text-orange-400 font-bold flex-shrink-0">3.</span>Make sure the CSV has a <strong className="text-white">rating</strong> column and a <strong className="text-white">review text</strong> column</li>
            <li className="flex gap-2"><span className="text-orange-400 font-bold flex-shrink-0">4.</span>Upload it here — analysis runs in under 60 seconds</li>
          </ol>
          <button onClick={onClose} className="mt-3 text-neutral-400 hover:text-white text-[10px]">Got it ✕</button>
        </div>
      )}
    </div>
  )
}

export default function LandingPage() {
  const [heroUrl, setHeroUrl]         = useState('')
  const [heroUrlError, setHeroUrlError] = useState('')
  const [ctaUrl, setCtaUrl]           = useState('')
  const [ctaUrlError, setCtaUrlError] = useState('')
  const [pricingTab, setPricingTab]   = useState<'packs' | 'subscription'>('subscription')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<{ step?: 'plan' | 'auth'; authMode?: 'signup' | 'login' }>({})
  const [showNewsletter, setShowNewsletter] = useState(false)
  const [nlEmail, setNlEmail]         = useState('')
  const [nlSubmitted, setNlSubmitted] = useState(false)
  const [nlError, setNlError]         = useState(false)
  const [csvMsg, setCsvMsg]           = useState('')
  const [activeTab, setActiveTab]     = useState('complaints')
  const [expandedComplaint, setExpandedComplaint] = useState<number | null>(0)
  const [compExpandedComplaint, setCompExpandedComplaint] = useState<number | null>(0)
  const [footerNlEmail, setFooterNlEmail]   = useState('')
  const [footerNlSubmitted, setFooterNlSubmitted] = useState(false)
  const [showCsvGuide, setShowCsvGuide] = useState(false)
  const [csvFile, setCsvFile]         = useState<File | null>(null)
  const [csvFileText, setCsvFileText] = useState('')
  const [showProductModal, setShowProductModal] = useState(false)
  const [productName, setProductName] = useState('')
  const [productCategory, setProductCategory] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productNameError, setProductNameError] = useState('')
  const [productCategoryError, setProductCategoryError] = useState('')
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
  const openCsv = () => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setAuthModalMode({ step: 'plan' }); setShowAuthModal(true); return }
      document.getElementById('csv-in')?.click()
    })
  }

  const onCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.csv')) { setCsvMsg('Please upload a .csv file'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCsvFile(f); setCsvFileText(ev.target?.result as string)
      setProductName(''); setProductCategory(''); setProductPrice('')
      setProductNameError(''); setProductCategoryError('')
      setShowProductModal(true); setCsvMsg('')
    }
    reader.readAsText(f)
    setCsvMsg(`Reading "${f.name}"...`)
  }

  const submitCsvWithProductInfo = async () => {
    if (!productName.trim()) { setProductNameError('Please enter your product name'); return }
    if (!productCategory.trim()) { setProductCategoryError('Please select a category'); return }
    if (!csvFile || !csvFileText) return
    setShowProductModal(false)
    setCsvMsg(`Preparing "${csvFile.name}"...`)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    const storeData = () => {
      try {
        localStorage.setItem('pendingCsvContent', csvFileText)
        localStorage.setItem('pendingCsvName', csvFile.name)
        localStorage.setItem('pendingCsvProductName', productName.trim())
        localStorage.setItem('pendingCsvProductCategory', productCategory.trim())
        localStorage.setItem('pendingCsvPrice', productPrice.trim())
        return true
      } catch { setCsvMsg('File too large to store. Please try a smaller CSV.'); return false }
    }
    if (user) { if (!storeData()) return; window.location.href = '/dashboard'; return }
    if (!storeData()) return
    await supabase.auth.signInWithOAuth({ provider: 'google', options: googleOAuthOptions(window.location.origin) })
  }

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
        pricingTab={pricingTab} setPricingTab={setPricingTab}
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

      {showProductModal && (
        <ProductInfoModal
          csvFile={csvFile}
          productName={productName} setProductName={setProductName}
          productNameError={productNameError} setProductNameError={setProductNameError}
          productCategory={productCategory} setProductCategory={setProductCategory}
          productCategoryError={productCategoryError} setProductCategoryError={setProductCategoryError}
          productPrice={productPrice} setProductPrice={setProductPrice}
          onClose={() => setShowProductModal(false)}
          onSubmit={submitCsvWithProductInfo}
        />
      )}
    </div>
  )
}
