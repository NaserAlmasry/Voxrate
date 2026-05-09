'use client'

import { useState } from 'react'

const CATEGORIES = [
  'Home Decor', 'Jewelry & Accessories', 'Clothing & Apparel', 'Art & Prints',
  'Handmade Crafts', 'Candles & Bath', 'Stationery & Paper', 'Toys & Games',
  'Food & Drink', 'Wedding', 'Baby & Kids', 'Pet Supplies', 'Other',
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="text-xs px-2.5 py-1 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-1.5 flex-shrink-0">
      {copied
        ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
        : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
      }
    </button>
  )
}

export default function ListingBuilderPage() {
  const [prompt, setPrompt]       = useState('')
  const [category, setCategory]   = useState('')
  const [materials, setMaterials] = useState('')
  const [price, setPrice]         = useState('')
  const [building, setBuilding]   = useState(false)
  const [result, setResult]       = useState<any | null>(null)
  const [error, setError]         = useState('')
  const [selectedTitle, setSelectedTitle] = useState(0)

  const build = async () => {
    if (!prompt.trim()) return
    setBuilding(true)
    setError('')
    setResult(null)
    setSelectedTitle(0)

    const res = await fetch('/api/listing-builder', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ prompt, category, materials, price }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to generate'); setBuilding(false); return }
    setResult(data)
    setBuilding(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold">AI listing builder</h1>
        <p className="text-xs text-neutral-400 mt-1">Describe your product in plain language — get a complete, SEO-optimized Etsy listing instantly</p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">What is your product? <span className="font-normal text-neutral-400">(required)</span></label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g. A handmade wooden cutting board with a custom name engraved on it, perfect as a wedding or housewarming gift. Made from maple wood, finished with food-safe oil."
            rows={4}
            maxLength={1000}
            className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-black transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-black transition-colors bg-white"
            >
              <option value="">Select...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Price ($)</label>
            <input
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="e.g. 45"
              className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-black transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Materials <span className="font-normal text-neutral-400">(optional)</span></label>
          <input
            value={materials}
            onChange={e => setMaterials(e.target.value)}
            placeholder="e.g. maple wood, food-safe mineral oil"
            className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-black transition-colors"
          />
        </div>

        <button
          onClick={build}
          disabled={building || !prompt.trim()}
          className="w-full py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {building ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round"/>
              </svg>
              Building listing…
            </>
          ) : 'Build my listing →'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-600">{error}</div>}

      {result && (
        <div className="space-y-4">
          {/* Titles */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Title options — pick your favourite</p>
            <div className="space-y-2">
              {result.titles?.map((t: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setSelectedTitle(i)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedTitle === i ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-snug">{t.title}</p>
                      <p className="text-xs text-neutral-400 mt-1">{t.why}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs ${t.charCount > 140 ? 'text-red-400' : 'text-neutral-400'}`}>{t.charCount} chars</span>
                      {selectedTitle === i && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {result.titles?.[selectedTitle] && (
              <div className="mt-3 flex justify-end">
                <CopyButton text={result.titles[selectedTitle].title} />
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                Tags <span className="font-normal normal-case text-neutral-400">({result.tags?.length || 0}/13)</span>
              </p>
              <CopyButton text={result.tags?.join(', ') || ''} />
            </div>
            <div className="flex flex-wrap gap-2">
              {result.tags?.map((tag: string, i: number) => (
                <span key={i} className="px-2.5 py-1 bg-orange-50 border border-orange-100 text-orange-700 text-xs rounded-full">{tag}</span>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Description</p>
              <CopyButton text={result.description || ''} />
            </div>
            <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">{result.description}</p>
          </div>

          {/* SEO tips */}
          {result.seoTips?.length > 0 && (
            <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-5">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">SEO tips</p>
              <ul className="space-y-2">
                {result.seoTips.map((tip: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-orange-400 flex-shrink-0 mt-0.5">→</span>
                    <p className="text-xs text-neutral-600">{tip}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={build}
            disabled={building}
            className="w-full py-3 border border-neutral-200 text-sm text-neutral-600 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Regenerate →
          </button>
        </div>
      )}
    </div>
  )
}
