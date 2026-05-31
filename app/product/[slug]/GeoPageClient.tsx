'use client'

import { useState, useEffect } from 'react'

interface Props {
  page: any
  complaints: any[]
  strengths: any[]
  buyerPhrases: string[]
  starBreakdown: Record<string, number>
  faqEntries: { question: string; answer: string }[]
  slug: string
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f97316' : '#ef4444'
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-neutral-500">Review Health Score</span>
        <span className="text-3xl font-bold" style={{ color }}>{score}<span className="text-lg text-neutral-400">/100</span></span>
      </div>
      <div className="h-3 w-full bg-neutral-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <p className="text-xs text-neutral-400 mt-1">
        {score >= 75 ? 'Strong review profile' : score >= 50 ? 'Mixed review profile' : 'Concerning review profile'}
      </p>
    </div>
  )
}

function StarBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-6 text-right text-neutral-500">{star}★</span>
      <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-neutral-400 text-xs">{pct}%</span>
    </div>
  )
}

function CtaBanner() {
  const [show, setShow] = useState<'analyze' | 'powered'>('analyze')
  useEffect(() => {
    const interval = setInterval(() => {
      setShow(prev => prev === 'analyze' ? 'powered' : 'analyze')
    }, show === 'analyze' ? 10000 : 3000)
    return () => clearInterval(interval)
  }, [show])

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        key={show}
        className="animate-fade-in bg-black text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-neutral-800 transition-colors"
        style={{ animation: 'fadeIn 0.5s ease-in-out' }}
        onClick={() => window.open('https://voxrate.app', '_blank')}
      >
        {show === 'analyze' ? (
          <>
            <span className="text-lg">🔍</span>
            <div>
              <p className="text-xs font-semibold leading-tight">Analyze your product for free</p>
              <p className="text-xs text-neutral-400">on Voxrate</p>
            </div>
          </>
        ) : (
          <>
            <span className="text-xs font-bold tracking-widest text-neutral-400">POWERED BY</span>
            <span className="font-bold text-white">Voxrate</span>
          </>
        )}
      </div>
    </div>
  )
}

export default function GeoPageClient({ page, complaints, strengths, buyerPhrases, starBreakdown, faqEntries, slug }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  // Track view client-side so every real visit is counted (not just ISR renders)
  useEffect(() => {
    fetch('/api/geo/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId: page.id }),
    }).catch(() => {})
  }, [page.id])
  const totalReviews = page.total_reviews ?? 0
  const shareUrl     = `https://voxrate.app/product/${slug}`

  const scoreColor = page.health_score >= 75 ? 'text-green-600' : page.health_score >= 50 ? 'text-orange-500' : 'text-red-500'

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-neutral-100 bg-white sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="https://voxrate.app" className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight">Voxrate</span>
            <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">Amazon Intelligence</span>
          </a>
          <a
            href="https://voxrate.app"
            className="text-xs bg-black text-white px-3 py-1.5 rounded-full hover:bg-neutral-800 transition-colors"
          >
            Analyze free →
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-10">

        {/* Hero */}
        <section>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-2">Verified Review Analysis</p>
          <h1 className="text-3xl font-bold text-neutral-900 leading-tight mb-1">{page.product_title}</h1>
          {page.asin && <p className="text-sm text-neutral-400">ASIN: {page.asin} · {page.marketplace}</p>}
          <div className="flex items-center gap-4 mt-3 text-sm text-neutral-500">
            <span>{totalReviews.toLocaleString()} reviews analyzed</span>
            {page.avg_rating && <span>★ {page.avg_rating} avg rating</span>}
            <span>Last updated {new Date(page.last_snapshot_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
        </section>

        {/* Health Score + Star Breakdown */}
        <section className="grid md:grid-cols-2 gap-8 p-6 bg-neutral-50 rounded-2xl">
          <HealthBar score={page.health_score} />
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-500 mb-3">Rating Breakdown</p>
            {[5, 4, 3, 2, 1].map(star => (
              <StarBar key={star} star={star} count={starBreakdown[String(star)] || 0} total={totalReviews} />
            ))}
          </div>
        </section>

        {/* Buyer Phrases */}
        {buyerPhrases.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-1">What buyers actually say</h2>
            <p className="text-sm text-neutral-500 mb-4">Real phrases from verified purchase reviews</p>
            <div className="flex flex-wrap gap-2">
              {buyerPhrases.slice(0, 12).map((phrase: string, i: number) => (
                <span key={i} className="bg-neutral-100 text-neutral-700 px-3 py-1.5 rounded-full text-sm">
                  ❝ {phrase} ❞
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Strengths */}
        {page.show_strengths && strengths.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-1">What buyers love</h2>
            <p className="text-sm text-neutral-500 mb-4">Top positive themes from verified reviews</p>
            <div className="space-y-3">
              {strengths.map((s: any, i: number) => (
                <div key={i} className="flex gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
                  <span className="text-green-500 text-lg mt-0.5">✓</span>
                  <div>
                    <p className="font-semibold text-neutral-800">{s.title}</p>
                    {s.marketingAngle && <p className="text-sm text-neutral-600 mt-0.5">{s.marketingAngle}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Complaints */}
        {page.show_complaints && complaints.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-1">Common complaints</h2>
            <p className="text-sm text-neutral-500 mb-4">Issues reported by verified buyers — data from Voxrate analysis</p>
            <div className="space-y-3">
              {complaints.map((c: any, i: number) => (
                <div key={i} className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-neutral-800">{c.title}</p>
                      {c.percentage && (
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                          {c.percentage}% of reviews
                        </span>
                      )}
                    </div>
                    {c.description && <p className="text-sm text-neutral-600 mt-0.5">{c.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Seller note */}
        {page.seller_bio && (
          <section className="p-5 border border-neutral-200 rounded-xl">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">From the seller</p>
            <p className="text-neutral-700 leading-relaxed">{page.seller_bio}</p>
          </section>
        )}

        {/* FAQ */}
        {faqEntries.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-4">Frequently asked questions</h2>
            <div className="space-y-2">
              {faqEntries.map((faq, i) => (
                <div key={i} className="border border-neutral-200 rounded-xl overflow-hidden">
                  <button
                    className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="font-medium text-neutral-800 pr-4">{faq.question}</span>
                    <span className="text-neutral-400 text-lg flex-shrink-0">{openFaq === i ? '−' : '+'}</span>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 text-neutral-600 text-sm leading-relaxed border-t border-neutral-100 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Amazon CTA */}
        <section className="text-center p-8 bg-neutral-900 rounded-2xl">
          <p className="text-neutral-400 text-sm mb-2">{totalReviews.toLocaleString()} verified reviews analyzed</p>
          <h3 className="text-2xl font-bold text-white mb-4">{page.product_title}</h3>
          <a
            href={page.amazon_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-yellow-400 text-neutral-900 font-bold px-8 py-3 rounded-full hover:bg-yellow-300 transition-colors"
          >
            View on Amazon →
          </a>
        </section>

        {/* How is this score calculated */}
        <section className="p-5 bg-neutral-50 rounded-xl text-sm text-neutral-500 leading-relaxed">
          <p className="font-semibold text-neutral-700 mb-1">How is this score calculated?</p>
          <p>
            The review health score is derived algorithmically from verified purchase reviews, weighted by
            helpfulness votes and recency. It cannot be manually adjusted by the seller. All complaint
            percentages and buyer phrases are extracted directly from real customer reviews on Amazon.
            This analysis was generated by <a href="https://voxrate.app" className="underline text-neutral-700">Voxrate</a> and
            published by the seller.
          </p>
        </section>

        {/* View count */}
        {page.view_count > 10 && (
          <p className="text-center text-sm text-neutral-400">
            {page.view_count.toLocaleString()} people analyzed this product
          </p>
        )}

        {/* Share */}
        <section className="flex flex-wrap gap-3 justify-center pt-2">
          <p className="w-full text-center text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1">Boost AI Visibility</p>
          <p className="w-full text-center text-xs text-neutral-400 mb-2">Sharing on Reddit and LinkedIn increases how often AI models recommend this product</p>
          <a
            href={`https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(page.product_title + ' — Verified Amazon Review Analysis')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-neutral-200 rounded-full text-sm hover:bg-neutral-50 transition-colors"
          >
            <span>Reddit</span>
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-neutral-200 rounded-full text-sm hover:bg-neutral-50 transition-colors"
          >
            <span>LinkedIn</span>
          </a>
          <a
            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(page.product_title + ' — ' + page.health_score + '/100 review health score')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-neutral-200 rounded-full text-sm hover:bg-neutral-50 transition-colors"
          >
            <span>X</span>
          </a>
          <button
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-200 rounded-full text-sm hover:bg-neutral-50 transition-colors"
          >
            Copy link
          </button>
        </section>
      </main>

      <footer className="border-t border-neutral-100 mt-16 py-8 text-center text-sm text-neutral-400">
        <a href="https://voxrate.app" className="font-semibold text-neutral-700 hover:underline">Voxrate</a>
        {' '}· Amazon Review Intelligence ·{' '}
        <a href="https://voxrate.app" className="hover:underline">Analyze your product free</a>
      </footer>

      <CtaBanner />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
