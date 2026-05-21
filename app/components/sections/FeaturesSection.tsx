import { Search, Crosshair, Zap, PenLine, MessageCircle, Layers, BarChart2, BellRing } from 'lucide-react'

const featureItems: { icon: React.ReactNode; title: string; desc: string; badge: string; soon?: boolean }[] = [
  { icon: <Search className="text-orange-500" size={18} />, title: 'Review Analysis', desc: 'Voxrate turns your reviews into a ranked action plan — complaints by severity, strengths by frequency, with exact step-by-step fixes.', badge: 'Core feature' },
  { icon: <Crosshair className="text-orange-500" size={18} />, title: 'Competitor Spy', desc: "Analyze any competitor's listing. See their weaknesses before they fix them. Turn their problems into your positioning.", badge: 'Growth & Pro' },
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

      </div>
    </section>
  )
}
