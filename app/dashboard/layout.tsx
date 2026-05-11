'use client'

// ============================================================
// DASHBOARD LAYOUT — voxrate/app/dashboard/layout.tsx
// ============================================================

import { useState, useEffect, Suspense } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import CheckoutRedirectHandler from '@/app/components/CheckoutRedirectHandler'
import OnboardingModal from '@/app/components/OnboardingModal'
import ErrorBoundary from '@/app/components/ErrorBoundary'
import { ToastProvider } from '@/app/components/Toast'

const NAV_ITEMS = [
  {
    label: 'Analyze',
    href: '/dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
  },
  {
    label: 'Library',
    href: '/dashboard/library',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    label: 'Reply',
    href: '/dashboard/reply',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    label: 'Competitor',
    href: '/dashboard/competitor',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    ),
  },
  {
    label: 'Grade',
    href: '/dashboard/grade',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    label: 'Builder',
    href: '/dashboard/listing-builder',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    label: 'Watchlist',
    href: '/dashboard/watchlist',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
  {
    label: 'Rewrite',
    href: '/dashboard/rewrite',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
  },
  {
    label: 'Monitor',
    href: '/dashboard/monitor',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
  {
    label: 'Shop',
    href: '/dashboard/shop-health',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    label: 'History',
    href: '/dashboard/history',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2"/>
      </svg>
    ),
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [plan, setPlan]       = useState('free')
  const [isAdmin, setIsAdmin] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const loadPlan = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('users').select('plan, credits, is_admin').eq('id', user.id).single()
    if (data?.plan) setPlan(data.plan)
    if (data?.is_admin) setIsAdmin(true)
    if (data?.credits != null) setCredits(data.credits)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthChecked(true)
      if (!session) { router.push('/'); return }
      setUserEmail(session.user.email ?? '')
      loadPlan()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { router.push('/') }
      else if (event === 'SIGNED_IN' && session) {
        setAuthChecked(true)
        setUserEmail(session.user.email ?? '')
        loadPlan()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (window.location.search.includes('upgraded=true')) {
      setShowUpgradeBanner(true)
      window.history.replaceState({}, '', window.location.pathname)
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { clearInterval(poll); return }
        const { data } = await supabase.from('users').select('plan, credits').eq('id', user.id).single()
        if (data?.plan && data.plan !== 'free') {
          setPlan(data.plan)
          if (data?.credits != null) setCredits(data.credits)
          clearInterval(poll)
          // Banner stays up 4s after plan confirmed so user sees their actual plan name
          setTimeout(() => setShowUpgradeBanner(false), 4000)
        }
        if (attempts >= 10) { clearInterval(poll); setShowUpgradeBanner(false) }
      }, 1500)
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const switchAccount = async () => {
    await supabase.auth.signOut()
    await new Promise(r => setTimeout(r, 300))
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }

  if (!authChecked) {
    return <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6]"><div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <ToastProvider>
    <div className="flex min-h-screen bg-[#FAF9F6]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        .sidebar { transition: width 0.25s ease; }
        .nav-label { transition: opacity 0.2s ease, width 0.25s ease; }
        .glow { transition: box-shadow 0.3s ease; }
        .glow:hover { box-shadow: 0 0 0 2px #000, 0 0 16px 3px rgba(249,115,22,0.45); }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .banner-slide { animation: slideDown 0.3s ease forwards; }
        @media (max-width: 767px) { .sidebar { position: fixed; z-index: 50; transform: translateX(-100%); transition: transform 0.25s ease; } .sidebar.mobile-open { transform: translateX(0); } }
      `}</style>

      {/*
        ── CHECKOUT REDIRECT HANDLER ──────────────────────────
        Detects ?checkout=plan&billing=X after OAuth redirect
        and fires Stripe checkout automatically.
        Wrapped in Suspense because useSearchParams() requires it
        in Next.js App Router.
      */}
      <Suspense fallback={null}>
        <CheckoutRedirectHandler />
      </Suspense>
      <OnboardingModal />

      {/* ── UPGRADE SUCCESS BANNER ── */}
      {showUpgradeBanner && (
        <div className="banner-slide fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-3 px-6 py-3 bg-green-500 text-white text-sm font-medium">
          <span>🎉</span>
          <span>Payment successful! Your plan has been upgraded. Welcome to {plan !== 'free' ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'your new plan'}!</span>
          <button onClick={() => setShowUpgradeBanner(false)} aria-label="Dismiss upgrade banner" className="ml-2 text-white/70 hover:text-white">✕</button>
        </div>
      )}

      {/* ── MOBILE OVERLAY ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── MOBILE HAMBURGER ── */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-neutral-200 shadow-sm"
        onClick={() => setMobileOpen(v => !v)}
        aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={mobileOpen}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {mobileOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
        </svg>
      </button>

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar fixed top-0 left-0 h-full bg-white border-r border-neutral-200 z-40 flex flex-col ${collapsed ? 'w-16' : 'w-56'} ${mobileOpen ? 'mobile-open' : ''}`}>

        <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-200">
          {!collapsed && (
            <a href="/dashboard">
              <img src="/logo.png" alt="Voxrate" height={28} style={{ objectFit: 'contain', maxWidth: 140 }} />
            </a>
          )}
          <button
            onClick={() => setCollapsed(v => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-black transition-colors ml-auto"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {collapsed ? <path d="M9 18l6-6-6-6"/> : <path d="M15 18l-6-6 6-6"/>}
            </svg>
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-label={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-black'
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </a>
            )
          })}
          {/* Admin link — only visible to admins */}
          {isAdmin && (
            <a
              href="/dashboard/admin"
              onClick={() => setMobileOpen(false)}
              aria-label={collapsed ? 'Admin' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mt-1 ${
                pathname === '/dashboard/admin'
                  ? 'bg-red-50 text-red-600'
                  : 'text-red-400 hover:bg-red-50 hover:text-red-600'
              }`}
            >
              <span className="flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </span>
              {!collapsed && <span className="nav-label">Admin</span>}
            </a>
          )}
        </nav>

        <div className="border-t border-neutral-200 p-3">
          {!collapsed && (
            <div className="mb-2 px-2">
              <p className="text-xs text-neutral-400 truncate">{userEmail}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  plan === 'pro'     ? 'bg-orange-100 text-orange-700' :
                  plan === 'starter' ? 'bg-blue-50 text-blue-700' :
                                       'bg-neutral-100 text-neutral-500'
                }`}>
                  {plan.charAt(0).toUpperCase() + plan.slice(1)}
                </span>
                {credits !== null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                    {credits} cr
                  </span>
                )}
              </div>
            </div>
          )}

          <button
            onClick={switchAccount}
            title="Switch Google account"
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors mb-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {!collapsed && <span>Switch account</span>}
          </button>

          <button
            onClick={signOut}
            aria-label="Sign out"
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      <main className={`flex-1 transition-all duration-250 md:${collapsed ? 'ml-16' : 'ml-56'} ml-0`}>
        <div className="h-16 bg-white border-b border-neutral-200 flex items-center px-6 pl-16 md:pl-6">
          <p className="text-sm text-neutral-400">
            {NAV_ITEMS.find(i => pathname === i.href || (i.href !== '/dashboard' && pathname.startsWith(i.href)))?.label ?? 'Dashboard'}
          </p>
        </div>
        <div className="p-4 md:p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
        <div className="px-6 pb-6">
          <p className="text-[10px] text-neutral-300 leading-relaxed">
            The term &quot;Etsy&quot; is a trademark of Etsy, Inc. This application uses Etsy&apos;s API, but is not endorsed or certified by Etsy.
          </p>
        </div>
      </main>
    </div>
    </ToastProvider>
  )
}