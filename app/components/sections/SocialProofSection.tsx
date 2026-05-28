export default function SocialProofSection() {
  return (
    <section className="py-20 px-6 bg-neutral-950">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-2">The research is clear</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Amazon reviews are your biggest lever.<br/>Almost no one pulls it.</h2>
          <p className="text-sm text-neutral-400 max-w-xl mx-auto">These numbers come from independent research — not our marketing team.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-10">
          {[
            {
              stat: '84%',
              claim: 'of Amazon sellers say reviews are "extremely or very important" to their business',
              source: 'eComEngine — Impact of Amazon Reviews, 200+ sellers surveyed',
              year: '2024',
              color: 'border-orange-500/30 bg-orange-500/5',
              statColor: 'text-orange-400',
            },
            {
              stat: '20×',
              claim: 'It takes 20+ five-star reviews to undo the damage of just one negative review',
              source: 'Seller Labs — Negative Review Recovery Study',
              year: '2024',
              color: 'border-red-500/30 bg-red-500/5',
              statColor: 'text-red-400',
            },
            {
              stat: '4–5%',
              claim: 'conversion rate lift for every 1-star improvement in your Amazon rating',
              source: 'Pattern Research — Amazon Star Rating Conversion Analysis',
              year: '2024',
              color: 'border-green-500/30 bg-green-500/5',
              statColor: 'text-green-400',
            },
            {
              stat: '69%',
              claim: 'of Amazon sellers are stagnant or losing money — only 23% are genuinely thriving',
              source: 'Marketplace Pulse — Seller Index 2026',
              year: '2026',
              color: 'border-blue-500/30 bg-blue-500/5',
              statColor: 'text-blue-400',
            },
          ].map(s => (
            <div key={s.stat} className={`rounded-2xl border p-6 ${s.color}`}>
              <p className={`text-5xl font-black mb-3 ${s.statColor}`}>{s.stat}</p>
              <p className="text-sm text-white font-medium leading-snug mb-3">{s.claim}</p>
              <p className="text-[10px] text-neutral-500 leading-relaxed">{s.source} · {s.year}</p>
            </div>
          ))}
        </div>

        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-5 text-center">What independent research says about the problem</p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                quote: 'Getting more reviews and managing negative reviews are the two biggest challenges Amazon sellers face — cited by over 200 active sellers surveyed.',
                attribution: 'eComEngine — Impact of Amazon Reviews Survey, 2024',
              },
              {
                quote: 'Only 1–2% of Amazon buyers leave a review. That means a single unhappy buyer who does write one carries disproportionate weight on your listing score.',
                attribution: 'Multiple sources including Jungle Scout Seller Report, 2024',
              },
              {
                quote: '45% of sellers receive fewer than 30 new reviews per month — yet each negative review in that small pool can meaningfully drop the overall rating.',
                attribution: 'eComEngine — 200+ Sellers Surveyed, 2024',
              },
            ].map((q, i) => (
              <div key={i} className="bg-neutral-800/50 rounded-xl p-4 border border-neutral-700/50">
                <p className="text-sm text-neutral-200 leading-relaxed mb-3 italic">&ldquo;{q.quote}&rdquo;</p>
                <p className="text-[10px] text-neutral-500">{q.attribution}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-5 border-t border-neutral-800 text-center">
            <p className="text-sm text-neutral-300 mb-1">A 0.5-star rating improvement typically lifts conversion 4–5%. Voxrate shows you exactly which fix gets you there.</p>
            <p className="text-xs text-neutral-500">Paste your Amazon URL and get a full breakdown of what&apos;s hurting your score — and the ranked action plan to fix it.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
