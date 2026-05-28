'use client'

type Props = {
  ctaUrl: string
  ctaUrlError: string
  setCtaUrl: (v: string) => void
  setCtaUrlError: (v: string) => void
  analyzeCta: () => void
}

export default function FinalCtaSection({ ctaUrl, ctaUrlError, setCtaUrl, setCtaUrlError, analyzeCta }: Props) {
  return (
    <section className="py-24 px-6 bg-gradient-to-b from-[#FAF9F6] to-orange-50">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-3">Stop guessing.<br />Start selling smarter.</h2>
        <p className="text-neutral-600 text-sm mb-10">See exactly what your buyers love, what they complain about, and how to fix it.</p>
        <div className={`flex flex-col sm:flex-row gap-2 p-2 bg-white rounded-2xl border shadow-sm max-w-xl mx-auto transition-colors ${ctaUrlError ? 'border-red-300' : 'border-neutral-200'}`}>
          <input type="url" value={ctaUrl} onChange={e => { setCtaUrl(e.target.value); setCtaUrlError('') }}
            onKeyDown={e => e.key === 'Enter' && analyzeCta()}
            placeholder="Paste your Amazon product URL or ASIN..."
            className="flex-1 px-4 py-3 text-base bg-transparent outline-none placeholder:text-neutral-400" />
          <button onClick={analyzeCta} className="glow-orange btn-press px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl whitespace-nowrap transition-colors">Analyze →</button>
        </div>
        {ctaUrlError && <p className="text-xs text-red-500 mt-2">{ctaUrlError}</p>}
        <p className="mt-5 text-xs text-neutral-500">First analysis is free · No credit card · Cancel anytime</p>
      </div>
    </section>
  )
}
