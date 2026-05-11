'use client'

import { useState } from 'react'
import Link from 'next/link'

function StarSelector({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="text-2xl leading-none transition-transform hover:scale-110"
        >
          <span style={{ color: n <= (hovered || value) ? '#f59e0b' : '#d1d5db' }}>★</span>
        </button>
      ))}
      <span className="text-xs text-neutral-400 ml-1">{value} star{value !== 1 ? 's' : ''}</span>
    </div>
  )
}

export default function ReplyPage() {
  const [review, setReview]         = useState('')
  const [productName, setProductName] = useState('')
  const [sellerName, setSellerName] = useState('')
  const [rating, setRating]         = useState(1)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [needsUpgrade, setNeedsUpgrade] = useState(false)
  const [replies, setReplies]       = useState<{ tone: string; text: string }[]>([])
  const [copied, setCopied]         = useState<number | null>(null)

  const handleGenerate = async () => {
    if (!review.trim()) { setError('Please paste the customer review first.'); return }
    setError('')
    setNeedsUpgrade(false)
    setLoading(true)
    setReplies([])

    try {
      const res = await fetch('/api/reply', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body:    JSON.stringify({ review, productName, sellerName, rating }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.upgrade) { setNeedsUpgrade(true); setLoading(false); return }
        setError(data.error || 'Something went wrong.'); setLoading(false); return
      }
      setReplies(data.replies || [])
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyReply = (text: string, i: number) => {
    navigator.clipboard.writeText(text)
    setCopied(i)
    setTimeout(() => setCopied(null), 2000)
  }

  const toneColors: Record<string, string> = {
    Empathetic:   'bg-blue-50 border-blue-200 text-blue-700',
    Professional: 'bg-neutral-50 border-neutral-200 text-neutral-600',
    Personal:     'bg-orange-50 border-orange-200 text-orange-700',
    Warm:         'bg-green-50 border-green-200 text-green-700',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Review reply generator</h1>
        <p className="text-xs text-neutral-400 mt-1">Paste a customer review and get 3 ready-to-send reply options</p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">

        {/* Review input */}
        <div>
          <label className="text-xs font-semibold text-neutral-600 block mb-2">Customer review *</label>
          <textarea
            value={review}
            onChange={e => setReview(e.target.value)}
            placeholder="Paste the customer review here..."
            rows={4}
            maxLength={1000}
            className="w-full text-sm border border-neutral-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition-all"
          />
          <p className="text-[10px] text-neutral-300 text-right mt-1">{review.length}/1000</p>
        </div>

        {/* Star rating */}
        <div>
          <label className="text-xs font-semibold text-neutral-600 block mb-2">Star rating they left</label>
          <StarSelector value={rating} onChange={setRating} />
        </div>

        {/* Optional fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-neutral-600 block mb-1.5">Product name <span className="text-neutral-300 font-normal">(optional)</span></label>
            <input
              type="text"
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder="e.g. Leather wallet"
              maxLength={200}
              className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 block mb-1.5">Your name <span className="text-neutral-300 font-normal">(optional)</span></label>
            <input
              type="text"
              value={sellerName}
              onChange={e => setSellerName(e.target.value)}
              placeholder="e.g. Sarah"
              maxLength={100}
              className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {needsUpgrade && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
            <p className="text-sm font-semibold text-orange-800 mb-1">Free plan limit reached</p>
            <p className="text-xs text-orange-600 mb-3">You&apos;ve used your 1 free AI generation. Upgrade to keep going.</p>
            <Link href="/dashboard/billing" className="inline-block px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors">
              Upgrade plan →
            </Link>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || !review.trim() || needsUpgrade}
          className="w-full py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/>
              </svg>
              Generating replies...
            </>
          ) : 'Generate replies'}
        </button>
      </div>

      {/* Results */}
      {replies.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">3 reply options — click any to copy</p>
          {replies.map((r, i) => {
            const colorClass = toneColors[r.tone] || 'bg-neutral-50 border-neutral-200 text-neutral-600'
            return (
              <div
                key={i}
                onClick={() => copyReply(r.text, i)}
                className="bg-white rounded-2xl border border-neutral-200 p-5 cursor-pointer hover:border-neutral-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${colorClass}`}>
                    {r.tone}
                  </span>
                  <span className={`text-xs font-medium transition-colors ${copied === i ? 'text-green-600' : 'text-neutral-300 group-hover:text-neutral-500'}`}>
                    {copied === i ? 'Copied!' : 'Click to copy'}
                  </span>
                </div>
                <p className="text-sm text-neutral-700 leading-relaxed">{r.text}</p>
              </div>
            )
          })}

          <button
            onClick={handleGenerate}
            className="w-full py-2.5 border border-neutral-200 text-sm text-neutral-500 rounded-xl hover:bg-neutral-50 transition-colors"
          >
            Regenerate new options
          </button>
        </div>
      )}
    </div>
  )
}
