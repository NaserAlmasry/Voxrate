'use client'

import { useState, useEffect } from 'react'

interface Props {
  reportId: string
  productName: string
  healthScore: number
  complaints: any[]
  strengths: any[]
  buyerPhrases: string[]
  asin?: string | null
}

type Step = 1 | 2 | 3 | 4 | 5 | 6

export default function GeoPublishWizard({ reportId, productName, healthScore, complaints, strengths, buyerPhrases, asin }: Props) {
  const [open, setOpen]               = useState(false)
  const [step, setStep]               = useState<Step>(1)
  const [sellerBio, setSellerBio]     = useState('')
  const [amazonUrl, setAmazonUrl]     = useState('')
  const [showComplaints, setShowComplaints] = useState(true)
  const [showStrengths, setShowStrengths]   = useState(true)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [result, setResult]           = useState<{ slug: string; pageUrl: string } | null>(null)
  const [status, setStatus]           = useState<any>(null)
  const [copied, setCopied]           = useState(false)
  const [unpublishing, setUnpublishing] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch(`/api/geo/status/${reportId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setStatus(d)
        if (d.published) setResult({ slug: d.slug, pageUrl: d.pageUrl })
      })
      .catch(() => {})
  }, [open, reportId])

  async function publish() {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/geo/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ reportId, sellerBio: sellerBio.trim() || null, amazonUrl, showComplaints, showStrengths }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to publish'); return }
      setResult(data)
      setStep(6)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function unpublish() {
    setUnpublishing(true)
    try {
      await fetch('/api/geo/publish', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ reportId }),
        credentials: 'include',
      })
      setResult(null)
      setStatus(null)
      setStep(1)
    } finally {
      setUnpublishing(false)
    }
  }

  function copy() {
    if (!result?.pageUrl) return
    navigator.clipboard.writeText(result.pageUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const scoreColor = healthScore >= 75 ? 'text-green-600' : healthScore >= 50 ? 'text-orange-500' : 'text-red-500'

  if (!open) {
    return (
      <div className="border border-neutral-200 rounded-2xl p-6 bg-neutral-50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-neutral-900 text-lg">Publish GEO Page</h3>
            <p className="text-sm text-neutral-500 mt-1">
              Make your product analysis public so ChatGPT, Perplexity, and Google can recommend it to buyers.
            </p>
            {status?.published && (
              <a href={status.pageUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold mt-2 hover:underline">
                ✓ Live — {status.viewCount || 0} views
              </a>
            )}
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex-shrink-0 bg-black text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-neutral-800 transition-colors"
          >
            {status?.published ? 'Manage' : 'Publish →'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-100">
          <div>
            <h2 className="font-bold text-neutral-900">Publish GEO Page</h2>
            {step < 6 && <p className="text-xs text-neutral-400 mt-0.5">Step {step} of 5</p>}
          </div>
          <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-700 text-xl">✕</button>
        </div>

        <div className="p-6">
          {/* Step 1 — Locked data */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Your analysis — locked data</p>
                <p className="text-sm text-neutral-500 mb-4">These values are locked from your analysis and cannot be changed. This ensures buyers see honest, verified data.</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                  <span className="text-sm text-neutral-600">Product</span>
                  <span className="text-sm font-semibold text-neutral-900 text-right max-w-[60%] truncate">{productName}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                  <span className="text-sm text-neutral-600">Health Score</span>
                  <span className={`text-sm font-bold ${scoreColor}`}>{healthScore}/100</span>
                </div>
                {asin && (
                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                    <span className="text-sm text-neutral-600">ASIN</span>
                    <span className="text-sm font-mono text-neutral-700">{asin}</span>
                  </div>
                )}
                {buyerPhrases.length > 0 && (
                  <div className="p-3 bg-neutral-50 rounded-xl">
                    <span className="text-sm text-neutral-600 block mb-2">Top buyer phrases</span>
                    <div className="flex flex-wrap gap-1">
                      {buyerPhrases.slice(0, 4).map((p, i) => (
                        <span key={i} className="text-xs bg-white border border-neutral-200 px-2 py-0.5 rounded-full text-neutral-600">❝{p}❞</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setStep(2)} className="w-full bg-black text-white py-3 rounded-xl font-semibold mt-2 hover:bg-neutral-800 transition-colors">
                Looks good — Next →
              </button>
            </div>
          )}

          {/* Step 2 — Strengths */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1">What to highlight</p>
                <p className="text-sm text-neutral-500">Show these strengths publicly? They come from your analysis.</p>
              </div>
              <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl">
                <div>
                  <p className="font-semibold text-sm text-neutral-800">Show strengths section</p>
                  <p className="text-xs text-neutral-500">Top positive themes from reviews</p>
                </div>
                <button
                  onClick={() => setShowStrengths(v => !v)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${showStrengths ? 'bg-green-500' : 'bg-neutral-200'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${showStrengths ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
              {showStrengths && strengths.slice(0, 3).map((s, i) => (
                <div key={i} className="p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-neutral-700">
                  ✓ {s.title}
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="flex-1 border border-neutral-200 py-3 rounded-xl text-sm hover:bg-neutral-50">← Back</button>
                <button onClick={() => setStep(3)} className="flex-1 bg-black text-white py-3 rounded-xl font-semibold hover:bg-neutral-800 transition-colors">Next →</button>
              </div>
            </div>
          )}

          {/* Step 3 — Complaints */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1">Complaint analysis</p>
                <p className="text-sm text-neutral-500">Show common complaints publicly? This builds buyer trust — honest pages get cited more by AI.</p>
              </div>
              <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl">
                <div>
                  <p className="font-semibold text-sm text-neutral-800">Show complaints section</p>
                  <p className="text-xs text-neutral-500">Issues reported by verified buyers</p>
                </div>
                <button
                  onClick={() => setShowComplaints(v => !v)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${showComplaints ? 'bg-red-400' : 'bg-neutral-200'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${showComplaints ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
              {showComplaints && complaints.slice(0, 3).map((c, i) => (
                <div key={i} className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-neutral-700 flex justify-between">
                  <span>{c.title}</span>
                  {c.percentage && <span className="text-red-500 font-bold text-xs">{c.percentage}%</span>}
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(2)} className="flex-1 border border-neutral-200 py-3 rounded-xl text-sm hover:bg-neutral-50">← Back</button>
                <button onClick={() => setStep(4)} className="flex-1 bg-black text-white py-3 rounded-xl font-semibold hover:bg-neutral-800 transition-colors">Next →</button>
              </div>
            </div>
          )}

          {/* Step 4 — Seller bio */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1">Your message (optional)</p>
                <p className="text-sm text-neutral-500">Write a short description about your product. This is the only part you fully control — it will be labeled "From the seller".</p>
              </div>
              <textarea
                value={sellerBio}
                onChange={e => setSellerBio(e.target.value.slice(0, 500))}
                placeholder="e.g. We've been refining this product for 3 years based on customer feedback. Our latest update addresses the cable length concern..."
                className="w-full border border-neutral-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black"
                rows={4}
              />
              <p className="text-xs text-neutral-400 text-right">{sellerBio.length}/500</p>
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="flex-1 border border-neutral-200 py-3 rounded-xl text-sm hover:bg-neutral-50">← Back</button>
                <button onClick={() => setStep(5)} className="flex-1 bg-black text-white py-3 rounded-xl font-semibold hover:bg-neutral-800 transition-colors">Next →</button>
              </div>
            </div>
          )}

          {/* Step 5 — Amazon URL + publish */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1">Your Amazon product link</p>
                <p className="text-sm text-neutral-500">Paste your Amazon product URL. Must match the analyzed product.{asin ? ` (ASIN: ${asin})` : ''}</p>
              </div>
              <input
                type="url"
                value={amazonUrl}
                onChange={e => setAmazonUrl(e.target.value)}
                placeholder="https://www.amazon.com/dp/B08..."
                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(4)} className="flex-1 border border-neutral-200 py-3 rounded-xl text-sm hover:bg-neutral-50">← Back</button>
                <button
                  onClick={publish}
                  disabled={loading || !amazonUrl.trim()}
                  className="flex-1 bg-black text-white py-3 rounded-xl font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Publishing…' : 'Publish →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 6 — Published */}
          {step === 6 && result && (
            <div className="space-y-5 text-center">
              <div className="text-5xl">🚀</div>
              <div>
                <h3 className="font-bold text-xl text-neutral-900">Your page is live!</h3>
                <p className="text-sm text-neutral-500 mt-1">AI models can now discover and recommend your product.</p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-neutral-50 rounded-xl text-left">
                <span className="text-xs text-neutral-500 truncate flex-1">{result.pageUrl}</span>
                <button onClick={copy} className="text-xs font-semibold text-black flex-shrink-0 hover:underline">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <a href={result.pageUrl} target="_blank" rel="noopener noreferrer"
                className="block w-full border border-neutral-200 py-3 rounded-xl text-sm font-semibold hover:bg-neutral-50 transition-colors">
                Preview page →
              </a>
              <div className="pt-2 border-t border-neutral-100">
                <p className="text-xs text-neutral-400 mb-3">Boost AI Visibility — share your page:</p>
                <div className="flex gap-2 justify-center">
                  {[
                    { label: 'Reddit', url: `https://www.reddit.com/submit?url=${encodeURIComponent(result.pageUrl)}&title=${encodeURIComponent(productName + ' — Verified Amazon Review Analysis')}` },
                    { label: 'LinkedIn', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(result.pageUrl)}` },
                    { label: 'X', url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(result.pageUrl)}&text=${encodeURIComponent(productName)}` },
                  ].map(s => (
                    <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 border border-neutral-200 rounded-full text-xs hover:bg-neutral-50 transition-colors">
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
              {status?.published && (
                <button onClick={unpublish} disabled={unpublishing}
                  className="text-xs text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-50">
                  {unpublishing ? 'Unpublishing…' : 'Unpublish this page'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
