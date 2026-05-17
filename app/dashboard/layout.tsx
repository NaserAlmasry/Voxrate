'use client'

// ============================================================
// DASHBOARD LAYOUT — voxrate/app/dashboard/layout.tsx
// ============================================================

import { useState, useEffect, Suspense } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import { PenLine, LayoutTemplate, Activity, MessageSquare, Crosshair, Eye, Bell, Home, LayoutGrid, Clock, Settings, Shield, Users, LogOut, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react'
import CheckoutRedirectHandler from '@/app/components/CheckoutRedirectHandler'
import OnboardingModal from '@/app/components/OnboardingModal'
import ErrorBoundary from '@/app/components/ErrorBoundary'

type NavItem = { label: string; href: string; icon: React.ReactNode }
type NavGroup = { section?: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    section: 'Optimize',
    items: [
      {
        label: 'Rewrite Listing',
        href: '/dashboard/rewrite',
        icon: <PenLine size={18} />,
      },
      {
        label: 'Build Listing',
        href: '/dashboard/listing-builder',
        icon: <LayoutTemplate size={18} />,
      },
      {
        label: 'Grade Listing',
        href: '/dashboard/grade',
        icon: <Activity size={18} />,
      },
      {
        label: 'Reply to Reviews',
        href: '/dashboard/reply',
        icon: <MessageSquare size={18} />,
      },
    ],
  },
  {
    section: 'Compete',
    items: [
      {
        label: 'Competitor',
        href: '/dashboard/competitor',
        icon: <Crosshair size={18} />,
      },
      {
        label: 'Watchlist',
        href: '/dashboard/watchlist',
        icon: <Eye size={18} />,
      },
      {
        label: 'Monitor',
        href: '/dashboard/monitor',
        icon: <Bell size={18} />,
      },
    ],
  },
  {
    section: 'My Shop',
    items: [
      {
        label: 'Shop Health',
        href: '/dashboard/shop-health',
        icon: <Home size={18} />,
      },
      {
        label: 'Library',
        href: '/dashboard/library',
        icon: <LayoutGrid size={18} />,
      },
      {
        label: 'History',
        href: '/dashboard/history',
        icon: <Clock size={18} />,
      },
    ],
  },
  {
    items: [
      {
        label: 'Settings',
        href: '/dashboard/settings',
        icon: <Settings size={18} />,
      },
    ],
  },
]

// Flat list used for breadcrumb lookup
const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items)

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
    if (!window.location.search.includes('upgraded=true')) return
    setShowUpgradeBanner(true)
    window.history.replaceState({}, '', window.location.pathname)
    let attempts = 0
    let bannerTimer: ReturnType<typeof setTimeout> | null = null
    const poll = setInterval(async () => {
      attempts++
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { clearInterval(poll); return }
      const { data } = await supabase.from('users').select('plan, credits').eq('id', user.id).single()
      if (data?.plan && data.plan !== 'free') {
        setPlan(data.plan)
        if (data?.credits != null) setCredits(data.credits)
        clearInterval(poll)
        bannerTimer = setTimeout(() => setShowUpgradeBanner(false), 4000)
      }
      if (attempts >= 10) { clearInterval(poll); setShowUpgradeBanner(false) }
    }, 1500)
    return () => {
      clearInterval(poll)
      if (bannerTimer) clearTimeout(bannerTimer)
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
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
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
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {NAV_GROUPS.map((group, gi) => {
            return (
              <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
                {/* Section header */}
                {group.section && !collapsed && (
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 select-none">
                    {group.section}
                  </p>
                )}
                {group.section && collapsed && <div className="my-2 mx-3 border-t border-neutral-100" />}

                {group.items.map(item => {
                  const isActive = pathname === item.href
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      aria-label={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-orange-50 text-orange-600'
                          : 'text-neutral-500 hover:bg-neutral-100 hover:text-black'
                      }`}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      {!collapsed && <span className="nav-label">{item.label}</span>}
                    </a>
                  )
                })}
              </div>
            )
          })}

          {/* Admin link — only visible to admins */}
          {isAdmin && (
            <a
              href="/dashboard/admin"
              onClick={() => setMobileOpen(false)}
              aria-label={collapsed ? 'Admin' : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors mt-1 ${
                pathname === '/dashboard/admin'
                  ? 'bg-red-50 text-red-600'
                  : 'text-red-400 hover:bg-red-50 hover:text-red-600'
              }`}
            >
              <span className="flex-shrink-0">
                <Shield size={18} />
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
                  plan === 'growth'  ? 'bg-green-50 text-green-700' :
                  plan === 'starter' ? 'bg-blue-50 text-blue-700' :
                                       'bg-neutral-100 text-neutral-500'
                }`}>
                  {plan.charAt(0).toUpperCase() + plan.slice(1)}
                </span>
                {credits !== null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                    <span className="w-2 h-2 rounded-full bg-current" />
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
            <Users size={16} />
            {!collapsed && <span>Switch account</span>}
          </button>

          <button
            onClick={signOut}
            aria-label="Sign out"
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={16} />
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
            Amazon is a trademark of Amazon.com, Inc. This application is not affiliated with, endorsed by, or certified by Amazon.
          </p>
        </div>
      </main>
    </div>
  )
}