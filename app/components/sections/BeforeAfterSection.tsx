export default function BeforeAfterSection() {
  return (
    <section className="py-24 px-6 bg-white border-t border-neutral-200">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 scroll-fade">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Live demo</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">What Voxrate finds in one analysis</h2>
          <p className="text-sm text-neutral-500">Demo listing — stainless water bottle, 1,000 reviews. This is exactly what your report looks like.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 scroll-fade">
          {/* WHAT THE LISTING LOOKS LIKE */}
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </div>
              <span className="text-sm font-bold text-red-700">What Voxrate finds</span>
            </div>
            <div className="space-y-3">
              <div className="bg-white rounded-xl p-4 border border-red-100">
                <p className="text-xs font-semibold text-neutral-500 mb-2">Health score</p>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-red-500">28</span>
                  <div className="flex-1 h-2 bg-red-100 rounded-full"><div className="h-full bg-red-400 rounded-full" style={{ width: '28%' }} /></div>
                </div>
                <p className="text-xs text-neutral-400 mt-2">Based on rating distribution, complaint severity, and listing signals</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-red-100">
                <p className="text-xs font-semibold text-red-700 mb-2">Top complaints detected (187 of 1,000 reviews)</p>
                <div className="space-y-1.5">
                  {[
                    'Handle snaps at the base after 3–6 weeks',
                    'Glaze color much darker than photos',
                    'No padding — arrived feeling fragile',
                  ].map(c => (
                    <div key={c} className="flex items-start gap-2 text-xs text-neutral-600">
                      <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </span>
                      {c}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-red-100">
                <p className="text-xs font-semibold text-neutral-500 mb-1">Current avg. rating</p>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 text-lg">★★½☆☆</span>
                  <span className="text-sm font-bold text-red-500">2.7</span>
                </div>
              </div>
            </div>
          </div>

          {/* WHAT VOXRATE TELLS YOU TO DO */}
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span className="text-sm font-bold text-green-700">Your action plan from Voxrate</span>
            </div>
            <div className="space-y-3">
              <div className="bg-white rounded-xl p-4 border border-green-100">
                <p className="text-xs font-semibold text-green-700 mb-1">Fix #1 — CRITICAL</p>
                <p className="text-xs text-neutral-700 font-medium mb-1">Handle snaps at the base after 3–6 weeks</p>
                <p className="text-xs text-neutral-500">Score both surfaces before joining, use slip, and dry slowly covered in plastic — prevents the crack that forms when parts dry at different rates.</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-green-100">
                <p className="text-xs font-semibold text-green-700 mb-1">Fix #2 — MEDIUM</p>
                <p className="text-xs text-neutral-700 font-medium mb-1">Glaze color much darker than photos</p>
                <p className="text-xs text-neutral-500">Reshoot on a cloudy day near a north-facing window — eliminates the warm color shift that makes your glaze look darker than it is.</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-green-100">
                <p className="text-xs font-semibold text-green-700 mb-1">Fix #3 — LOW</p>
                <p className="text-xs text-neutral-700 font-medium mb-1">No padding — arrived feeling fragile</p>
                <p className="text-xs text-neutral-500">Switch to a double-wall box with foam inserts — mug cannot move in transit. ~$1.05/unit cost increase.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 scroll-fade">
          {[
            { stat: '3', label: 'ranked complaints', sub: 'each with exact fixes' },
            { stat: '187', label: 'reviews flagged', sub: 'for the #1 complaint alone' },
            { stat: '19%', label: 'of buyers affected', sub: 'by the top complaint' },
            { stat: '<60s', label: 'to full action plan', sub: 'from paste to fix list' },
          ].map(({ stat, label, sub }) => (
            <div key={stat} className="bg-white border border-neutral-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-orange-600">{stat}</p>
              <p className="text-xs font-semibold text-neutral-700 mt-0.5">{label}</p>
              <p className="text-[10px] text-neutral-400 mt-0.5 leading-snug">{sub}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-400 text-center mt-4">Demo listing — stainless water bottle with 1,000 reviews. Paste any Amazon URL to see your real report.</p>
      </div>
    </section>
  )
}
