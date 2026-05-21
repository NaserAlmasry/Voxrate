export default function FooterTrustBar() {
  return (
    <div className="bg-neutral-950 py-5 px-6">
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-center">
        {[
          { n: '84%', label: 'of sellers say reviews are critical', src: 'eComEngine, 2024' },
          { n: '4–5%', label: 'conversion lift per star improvement', src: 'Pattern Research, 2024' },
          { n: '20×', label: 'reviews needed to undo one bad one', src: 'Seller Labs, 2024' },
        ].map(s => (
          <div key={s.n} className="flex items-center gap-3">
            <span className="text-xl font-black text-orange-400">{s.n}</span>
            <div className="text-left">
              <p className="text-xs text-neutral-300">{s.label}</p>
              <p className="text-[10px] text-neutral-600">{s.src}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
