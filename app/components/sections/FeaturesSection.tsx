import { Search, Crosshair, Zap, PenLine, MessageCircle, Layers, BarChart2, BellRing, Puzzle } from 'lucide-react'

const featureItems: { icon: React.ReactNode; title: string; desc: string; badge: string; soon?: boolean }[] = [
  { icon: <Search className="text-orange-500" size={18} />, title: 'Review Analysis', desc: 'Voxrate turns your reviews into a ranked action plan — complaints by severity, strengths by frequency, with exact step-by-step fixes.', badge: 'Core feature' },
  { icon: <Crosshair className="text-orange-500" size={18} />, title: 'Competitor Spy', desc: "Paste any competitor's Amazon URL and Voxrate surfaces their top complaints, weak spots, and the buyer keywords they're missing. Some sellers are already running tools like this on your listing.", badge: 'All paid plans' },
  { icon: <Zap className="text-orange-500" size={18} />, title: 'Listing Grader', desc: 'Get an A–F grade on your title, tags, description and pricing separately — with specific fixes for each.', badge: 'Free tool' },
  { icon: <PenLine className="text-orange-500" size={18} />, title: 'AI Description Rewriter', desc: 'Rewrite your listing description using your own review keywords and insights. SEO-optimized in one click.', badge: 'Free tool' },
  { icon: <MessageCircle className="text-orange-500" size={18} />, title: 'Review Reply Generator', desc: '3 ready-to-paste reply options for any review — empathetic, professional, or personal tone.', badge: 'Free tool' },
  { icon: <Layers className="text-orange-500" size={18} />, title: 'AI Listing Builder', desc: 'Generate a complete listing from scratch — title options, 13 SEO tags, and full description from a short prompt.', badge: 'Free tool' },
  { icon: <BarChart2 className="text-orange-500" size={18} />, title: 'Shop Health Score', desc: "See your entire shop's health at a glance — aggregated score, top recurring complaints, and 3 priority actions.", badge: 'Free' },
  { icon: <BellRing className="text-orange-500" size={18} />, title: 'Sentiment Alerts', desc: 'Get an email digest of new 1★ and 2★ reviews on your schedule — every 2 weeks or monthly. Catch problems before they cost you sales.', badge: 'Growth & Pro' },
]

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14 scroll-fade">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Everything you need</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">One tool. Every edge.</h2>
          <p className="text-sm text-neutral-500 max-w-xl mx-auto">From diagnosing why buyers leave to generating the copy that makes them stay — all in one dashboard</p>
        </div>

        {/* Core paid features — big cards */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">
          {featureItems.slice(0, 2).map((f) => (
            <div key={f.title} className="feat-card bg-white rounded-2xl border border-neutral-200 p-6 scroll-fade">
              <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-base mb-1.5">{f.title}</h3>
              <p className="text-sm text-neutral-500 leading-relaxed mb-3">{f.desc}</p>
              <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full">{f.badge}</span>
            </div>
          ))}
        </div>

        {/* Free tools — compact grid */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 scroll-fade mb-5">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-4">Also included free on every plan</p>
          <div className="grid md:grid-cols-2 gap-3">
            {featureItems.slice(2, 7).map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-neutral-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-800">{f.title}</p>
                  <p className="text-xs text-neutral-400 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chrome Extension — full-width highlight card */}
        <div className="bg-black rounded-2xl p-6 scroll-fade">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5 mb-6">
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Puzzle className="text-orange-400" size={22} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-base text-white">Chrome Extension</h3>
                <span className="text-[10px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">Works on Amazon</span>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed">Install once and Voxrate lives inside Amazon. Collects reviews through your own session — no rate limits, no scraper costs — and surfaces intelligence directly on the pages you already work on. Included with all paid plans.</p>
            </div>
            <a href="/dashboard/settings/extension" className="flex-shrink-0 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
              Get the extension →
            </a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>, title: 'Competitor Sidebar', desc: 'Analysis panel appears on any Amazon product page — no tab switching' },
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, title: 'Listing Velocity', desc: 'Tracks rating and review count changes over time for any ASIN' },
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>, title: 'Seller Central Scanner', desc: 'Reads your account health and flags performance issues directly from SC' },
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, title: 'Review Monitor', desc: 'Detects new 1★ and 2★ reviews on your listings and alerts you automatically' },
            ].map(f => (
              <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="w-7 h-7 bg-orange-500/15 rounded-lg flex items-center justify-center text-orange-400 flex-shrink-0">
                  {f.icon}
                </div>
                <p className="text-xs font-semibold text-white leading-snug">{f.title}</p>
                <p className="text-[11px] text-neutral-500 leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
