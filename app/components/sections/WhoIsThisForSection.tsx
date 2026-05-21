export default function WhoIsThisForSection() {
  return (
    <section className="py-24 px-6 bg-[#FAF9F6]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 scroll-fade">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Is this for you?</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Who gets the most out of Voxrate</h2>
          <p className="text-sm text-neutral-500 max-w-xl mx-auto">Best results come from listings with 20+ reviews — the more reviews, the more precise the patterns.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5 scroll-fade">
          {[
            {
              emoji_replaced: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
              who: 'New sellers',
              fit: 'Great fit',
              fitColor: 'text-green-600 bg-green-50',
              desc: 'Just launched your first listings and getting mixed reviews? Find out which specific issues are turning buyers away — before they snowball into a pattern.',
              useCase: 'Fix problems early, before your ranking takes a hit',
            },
            {
              emoji_replaced: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
              who: 'Growing sellers',
              fit: 'Best fit',
              fitColor: 'text-orange-600 bg-orange-50',
              desc: "You have reviews coming in but sales have plateaued. Something's holding you back — complaints you haven't spotted, or strengths you're not promoting. Voxrate finds both.",
              useCase: 'Break through the plateau with data, not guesswork',
            },
            {
              emoji_replaced: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
              who: 'Experienced sellers',
              fit: 'Great fit',
              fitColor: 'text-green-600 bg-green-50',
              desc: "You've optimized your listings but competitors keep closing the gap. Analyze their reviews to find their blind spots — and yours — and position your shop ahead.",
              useCase: 'Stay ahead of competitors with intelligence they don\'t have',
            },
          ].map(item => (
            <div key={item.who} className="bg-white rounded-2xl border border-neutral-200 p-6 scroll-fade feat-card">
              <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
                {item.emoji_replaced}
              </div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{item.who}</h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.fitColor}`}>{item.fit}</span>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed mb-4">{item.desc}</p>
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                <p className="text-xs font-medium text-neutral-700">{item.useCase}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-neutral-50 border border-neutral-200 rounded-2xl p-5 scroll-fade">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Not the right fit if...</p>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              "You haven't launched yet and have zero reviews",
              "You sell on platforms other than Amazon — analysis is built around Amazon listings and review structure",
              "You're looking for keyword research before buyers find you — Voxrate works with what buyers say after they buy, not search volume",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-neutral-500">
                <span className="w-4 h-4 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
