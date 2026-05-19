'use client'

import { useState } from 'react'
import Link from 'next/link'

function ValidationError({ message }: { message: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-start gap-1.5">
      <p className="text-xs text-red-500 flex-1">{message}</p>
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-4 h-4 rounded-full bg-red-100 text-red-400 text-[10px] font-bold flex items-center justify-center hover:bg-red-200 transition-colors mt-0.5"
          aria-label="Why is this blocked?"
        >
          ?
        </button>
        {open && (
          <div className="absolute right-0 top-6 z-10 w-72 bg-white border border-neutral-200 rounded-xl shadow-lg p-4 text-xs text-neutral-600 leading-relaxed">
            <p className="font-semibold text-neutral-800 mb-1.5">Why is this being blocked?</p>
            <p className="mb-2">Our system checks that the text you paste is an actual customer review — it looks for product-related language, real words, and a minimum amount of content. This helps prevent misuse and ensures the AI generates useful, relevant replies.</p>
            <p className="mb-3">Common reasons: the text is too short, contains only random characters, or doesn&apos;t mention anything product-related.</p>
            <p className="text-neutral-400">If you believe this is a mistake, <a href="mailto:info@voxrate.app" className="text-black underline font-medium">contact us</a> and we&apos;ll look into it.</p>
          </div>
        )}
      </div>
    </div>
  )
}

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
  const [replies, setReplies]       = useState<{ tone: string; text: string }[]>([])
  const [copied, setCopied]         = useState<number | null>(null)

  const handleGenerate = async () => {
    if (!review.trim()) { setError('Please paste the customer review first.'); return }
    setError('')
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
            placeholder="e.g. The bottle looks great but the lid started leaking after a week of use. Very disappointed as I paid premium price for this. Also the color is slightly different from the photos."
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

        {error && <ValidationError message={error} />}


        <button
          onClick={handleGenerate}
          disabled={loading || !review.trim()}
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
