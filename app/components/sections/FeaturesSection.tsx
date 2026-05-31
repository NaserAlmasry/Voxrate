import { Search, Crosshair, Zap, PenLine, MessageCircle, Layers, BarChart2, BellRing, Puzzle, Eye, GitCompare, Bell } from 'lucide-react'

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14 scroll-fade">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Everything you need</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">One tool. Every edge.</h2>
          <p className="text-sm text-neutral-500 max-w-xl mx-auto">From diagnosing why buyers leave to catching a review attack at 2am — all in one dashboard</p>
        </div>

        {/* Core paid features — big cards */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">
          <div className="feat-card bg-white rounded-2xl border border-neutral-200 p-6 scroll-fade">
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
              <Search className="text-orange-500" size={18} />
            </div>
            <h3 className="font-semibold text-base mb-1.5">Review Analysis</h3>
            <p className="text-sm text-neutral-600 leading-relaxed mb-3">Voxrate turns your reviews into a ranked action plan — complaints by severity, strengths by frequency, with exact step-by-step fixes for each.</p>
            <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full">Core feature</span>
          </div>
          <div className="feat-card bg-white rounded-2xl border border-neutral-200 p-6 scroll-fade">
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
              <Crosshair className="text-orange-500" size={18} />
            </div>
            <h3 className="font-semibold text-base mb-1.5">Competitor Spy</h3>
            <p className="text-sm text-neutral-600 leading-relaxed mb-3">Paste any competitor's Amazon URL and Voxrate surfaces their top complaints, weak spots, and the buyer keywords they're missing. Their weakness is your next bullet point.</p>
            <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full">All paid plans</span>
          </div>
        </div>

        {/* Chrome Extension — full-width highlight card */}
        <div className="bg-black rounded-2xl p-6 scroll-fade mb-5">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5 mb-6">
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Puzzle className="text-orange-400" size={22} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-base text-white">Chrome Extension</h3>
                <span className="text-[10px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">Works on Amazon</span>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed">Install once and Voxrate works inside Amazon as you browse. Competitor weak spots appear as a sidebar panel without switching tabs. Review velocity spikes are flagged in real time. Included free with all paid plans.</p>
            </div>
            <a href="/extension" className="flex-shrink-0 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
              Learn more →
            </a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
                title: 'Competitor Sidebar',
                desc: "Visit any competitor listing — their top complaints appear in a panel on the right. No tab switching.",
              },
              {
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
                title: 'Review Velocity',
                desc: "Detects sudden spikes in 1★ reviews on any product you visit — yours or a competitor's.",
              },
              {
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
                title: 'SC Health Scanner',
                desc: 'Reads your Seller Central account health automatically on each visit. Alerts if something needs action.',
                soon: true,
              },
              {
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
                title: 'Review Scraper',
                desc: 'Powers all Voxrate analyses — reads reviews from Amazon pages you visit, silently, in the background.',
              },
            ].map(f => (
              <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-orange-500/15 rounded-lg flex items-center justify-center text-orange-400 flex-shrink-0">
                    {f.icon}
                  </div>
                  {'soon' in f && f.soon && (
                    <span className="text-[9px] font-semibold text-neutral-400 bg-white/10 px-1.5 py-0.5 rounded-full">Soon</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-white leading-snug">{f.title}</p>
                <p className="text-[11px] text-neutral-500 leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Free tools — compact grid */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 scroll-fade mb-5">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-4">Also included free on every plan</p>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { icon: <Zap className="text-orange-500" size={18} />, title: 'Listing Grader', desc: 'Get an A–F grade on your title, tags, description and pricing separately — with specific fixes for each.' },
              { icon: <PenLine className="text-orange-500" size={18} />, title: 'AI Description Rewriter', desc: 'Rewrite your listing description using keywords and complaints pulled directly from your own Voxrate report.' },
              { icon: <MessageCircle className="text-orange-500" size={18} />, title: 'Review Reply Generator', desc: '3 ready-to-paste reply options for any review — empathetic, professional, or personal tone.' },
              { icon: <Layers className="text-orange-500" size={18} />, title: 'AI Listing Builder', desc: 'Generate a complete listing from scratch — title options, 13 SEO tags, and full description from a short prompt.' },
              { icon: <BarChart2 className="text-orange-500" size={18} />, title: 'Shop Health Score', desc: "Aggregated health score across all your products — top recurring complaints and 3 priority actions at a glance." },
            ].map(f => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-neutral-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-800">{f.title}</p>
                  <p className="text-xs text-neutral-600 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pro monitoring features */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 scroll-fade mb-5">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-4">Pro — automatic monitoring</p>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              {
                icon: <Bell className="text-orange-500" size={18} />,
                title: 'Review Monitoring',
                desc: 'Add up to 10 products. Voxrate checks for new 1★ and 2★ reviews automatically — no manual re-analysis needed.',
              },
              {
                icon: <BellRing className="text-orange-500" size={18} />,
                title: 'Attack Alerts',
                desc: '3+ new negative reviews in one cycle triggers a "possible attack" email. If the reviews share similar wording, it escalates to "coordinated attack detected".',
              },
              {
                icon: <Eye className="text-orange-500" size={18} />,
                title: 'Competitor Watchlist',
                desc: 'Track competitor health scores over 90 days. Get alerted when a competitor\'s score drops — their weakness is your opportunity.',
              },
              {
                icon: <GitCompare className="text-orange-500" size={18} />,
                title: 'Sentiment Alerts',
                desc: 'Scheduled digest of new 1★ and 2★ reviews on your products — weekly, biweekly, or monthly. Catch gradual quality decline before it shows in your rating.',
              },
            ].map(f => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-neutral-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-800">{f.title}</p>
                  <p className="text-xs text-neutral-600 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
