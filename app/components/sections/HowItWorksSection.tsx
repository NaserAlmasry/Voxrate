export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-white border-y border-neutral-200">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">How it works</h2>
        <p className="text-sm text-neutral-600 mb-14">From listing URL to full action plan</p>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0 scroll-fade-group">
          {[
            {
              n: 1,
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
              title: 'Paste your Amazon URL or ASIN',
              body: "Drop in any Amazon product link or ASIN. No setup, no forms, no configuration.",
            },
            {
              n: 2,
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
              title: 'Voxrate surfaces the complaints that cost you sales',
              body: 'Voxrate reads your most critical reviews, finds complaint patterns, hidden strengths, and buyer keywords specific to your listing.',
            },
            {
              n: 3,
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
              title: 'Get your full action plan',
              body: 'See exactly what to fix, what to promote, and which words to add to your listing — grounded in real buyer language.',
            },
          ].map((s, idx) => (
            <div key={s.n} className="flex flex-col md:flex-row items-center">
              {/* Step card */}
              <div className="flex flex-col items-center text-center w-full md:w-64 px-4">
                <div className="relative mb-5">
                  <div className="card-lift w-20 h-20 bg-white rounded-2xl shadow-md border border-neutral-100 flex items-center justify-center mx-auto cursor-default">
                    {s.icon}
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shadow">{s.n}</span>
                </div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{s.body}</p>
              </div>
              {/* Arrow between steps only */}
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
      </div>
    </section>
  )
}
