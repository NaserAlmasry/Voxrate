export default function BeforeAfterSection() {
  const rows = [
    {
      situation: 'A wave of 1★ reviews hits their listing over 3 days',
      without: 'Finds out 3 weeks later when BSR has already tanked and sales dropped 40%. No idea if it was real buyers or an attack. Spends days reading reviews manually with no way to prove anything to Amazon.',
      with: 'Email arrives within 24 hours. Attack Alerts detected 7 new 1★ reviews — 4 flagged as coordinated (shared phrasing across reviews). Seller reports to Amazon with evidence the same day, before the rating is affected.',
    },
    {
      situation: "A top competitor's product starts getting complaints",
      without: 'Completely blind to it. Competitor weakness is invisible. Still fighting for the same keywords at the same price, missing the window when buyers are actively looking for an alternative.',
      with: 'Watchlist flags competitor score dropped from 74 → 61. Competitor Spy surfaces "lid hinge cracking" as their new #1 complaint. Seller adds "reinforced stainless lid — no plastic hinge" to their title that week and captures the switching buyers.',
    },
    {
      situation: 'Listing has 1,000 reviews — what do you fix first?',
      without: 'Reads 50 recent reviews manually. Fixes the most visible complaint. The actual #1 issue — mentioned in 203 reviews and responsible for 74% of all 1-star ratings — stays unfixed because it\'s buried.',
      with: 'Health score: 28/100. Top complaint ranked by severity and frequency: "lid leaks when tilted" — 203 of 1,000 reviews. Fix given: double-seal silicone gasket, ~$0.90/unit supplier upgrade. Decision made in under 60 seconds.',
    },
    {
      situation: 'Trying to improve listing copy and SEO',
      without: 'Uses keyword research tools. Title is optimized for search volume. "Ice retention" doesn\'t appear anywhere despite 341 buyers independently writing "ice still there after 18 hours" in 5-star reviews — the strongest selling point is invisible.',
      with: 'Review analysis surfaces the exact phrase buyers use. AI rewriter generates: "Ice Retention 18+ Hours — Verified by 341 Buyers." Listing updated in 10 minutes using language buyers already proved converts.',
    },
    {
      situation: '1★ and 2★ reviews keep coming in — is quality declining or is it an issue with one batch?',
      without: 'No way to know without manually tracking reviews over weeks. Sentiment alerts don\'t exist. By the time the pattern is obvious, the rating has already dropped and rankings have slipped.',
      with: 'Sentiment Alerts emails a digest of every new 1★ and 2★ review on a weekly schedule. Seller spots "paint chipping at base" appearing across 12 new reviews in 2 weeks — traces it to a specific supplier batch — catches the defect before it spreads to the next shipment.',
    },
  ]

  return (
    <section className="py-24 px-6 bg-[#FAF9F6] border-t border-neutral-200">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 scroll-fade">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">The difference</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Same seller. Same product.<br/>Two very different outcomes.</h2>
          <p className="text-sm text-neutral-500 max-w-xl mx-auto">What happens when things go wrong — and when you have the tools to catch them first.</p>
        </div>

        <div className="space-y-4 scroll-fade">
          {rows.map((row, i) => (
            <div key={i} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-200">
                <p className="text-xs font-semibold text-neutral-600">Situation: {row.situation}</p>
              </div>
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-100">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </div>
                    <p className="text-xs font-bold text-red-600">Without Voxrate</p>
                  </div>
                  <p className="text-sm text-neutral-600 leading-relaxed">{row.without}</p>
                </div>
                <div className="p-5 bg-green-50/30">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <p className="text-xs font-bold text-green-700">With Voxrate</p>
                  </div>
                  <p className="text-sm text-neutral-600 leading-relaxed">{row.with}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 scroll-fade">
          {[
            { stat: '24h', label: 'attack detected', sub: 'vs. weeks later without alerts' },
            { stat: '60s', label: 'to ranked fix list', sub: 'from 1,000 reviews to action plan' },
            { stat: '74%', label: 'of 1★ reviews', sub: 'traced to one fixable complaint' },
            { stat: '13pt', label: 'competitor drop', sub: 'visible before buyers switch to you' },
          ].map(({ stat, label, sub }) => (
            <div key={stat} className="bg-white border border-neutral-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-orange-600">{stat}</p>
              <p className="text-xs font-semibold text-neutral-700 mt-0.5">{label}</p>
              <p className="text-[10px] text-neutral-400 mt-0.5 leading-snug">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
