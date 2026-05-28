export default function HowItWorksSection() {
  const steps = [
    {
      n: 1,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      ),
      title: 'Paste your Amazon URL or ASIN',
      body: 'Drop in any Amazon product link or ASIN — yours or a competitor\'s. No setup, no forms.',
    },
    {
      n: 2,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      ),
      title: 'Voxrate reads every review and finds the patterns',
      body: 'Complaint themes ranked by severity, hidden strengths, buyer keywords, and a health score — all from the reviews your customers already wrote.',
    },
    {
      n: 3,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
      title: 'Get a ranked fix list with exact steps',
      body: 'Not "improve your packaging." Exact: fix this, say this, add this keyword. Re-analyze next month and watch your score climb.',
    },
    {
      n: 4,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
          <circle cx="17" cy="8" r="2"/>
          <path d="M17 10v2"/>
        </svg>
      ),
      title: 'Install the extension — Voxrate lives inside Amazon',
      body: 'One install. Then competitor reports appear as a sidebar on any product page, new 1★ reviews alert you automatically, and your Seller Central health is scanned every visit.',
      highlight: true,
    },
  ]

  return (
    <section id="how-it-works" className="py-24 px-6 bg-white border-y border-neutral-200">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">How it works</h2>
        <p className="text-sm text-neutral-600 mb-14">From listing URL to full action plan — and a tool that runs in the background while you sell</p>

        {/* Steps 1–3 */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0 scroll-fade-group mb-10">
          {steps.slice(0, 3).map((s, idx) => (
            <div key={s.n} className="flex flex-col md:flex-row items-center">
              <div className="flex flex-col items-center text-center w-full md:w-60 px-4">
                <div className="relative mb-5">
                  <div className="card-lift w-20 h-20 bg-white rounded-2xl shadow-md border border-neutral-100 flex items-center justify-center mx-auto cursor-default">
                    {s.icon}
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shadow">{s.n}</span>
                </div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{s.body}</p>
              </div>
              {idx < 2 && (
                <div className="flex-shrink-0 my-4 md:my-0 md:mx-2 rotate-90 md:rotate-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="13 6 19 12 13 18"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Step 4 — extension highlight */}
        <div className="max-w-2xl mx-auto bg-neutral-900 rounded-2xl p-6 text-left flex gap-5 items-start scroll-fade">
          <div className="relative shrink-0">
            <div className="w-16 h-16 bg-neutral-800 rounded-xl flex items-center justify-center">
              {steps[3].icon}
            </div>
            <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shadow">4</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white">{steps[3].title}</h3>
              <span className="text-[10px] font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full uppercase tracking-wide">Free with paid plans</span>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed">{steps[3].body}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {['Competitor sidebar overlay', 'New review alerts', 'SC health scanner', 'Listing velocity tracker'].map(f => (
                <span key={f} className="text-[11px] bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded-full border border-neutral-700">{f}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
