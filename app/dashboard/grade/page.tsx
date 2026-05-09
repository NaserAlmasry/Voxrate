'use client'

import { useState } from 'react'

const GRADES = ['A', 'B', 'C', 'D', 'F'] as const
const GRADE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  A: { text: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
  B: { text: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100' },
  C: { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
  D: { text: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200' },
  F: { text: 'text-red-600',    bg: 'bg-red-100',   border: 'border-red-300' },
}

function GradeCard({ label, data }: { label: string; data: any }) {
  if (!data) return null
  const c = GRADE_COLORS[data.grade] || GRADE_COLORS['C']
  return (
    <div className={`bg-white rounded-2xl border ${c.border} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{label}</p>
        <div className={`w-10 h-10 rounded-xl border-2 ${c.border} ${c.bg} flex items-center justify-center text-xl font-black ${c.text}`}>
          {data.grade}
        </div>
      </div>
      <div className="w-full bg-neutral-100 rounded-full h-1.5 mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${data.score >= 66 ? 'bg-green-400' : data.score >= 38 ? 'bg-orange-400' : 'bg-red-400'}`}
          style={{ width: `${data.score}%` }}
        />
      </div>
      <p className="text-xs text-neutral-600 mb-3">{data.summary}</p>
      {data.fixes?.length > 0 && (
        <ul className="space-y-1.5">
          {data.fixes.map((f: string, i: number) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-orange-400 flex-shrink-0 mt-0.5">→</span>
              <p className="text-xs text-neutral-600">{f}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function GradePage() {
  const [title, setTitle]       = useState('')
  const [tags, setTags]         = useState('')
  const [description, setDesc]  = useState('')
  const [price, setPrice]       = useState('')
  const [grading, setGrading]   = useState(false)
  const [result, setResult]     = useState<any | null>(null)
  const [error, setError]       = useState('')

  const grade = async () => {
    if (!title && !description) return
    setGrading(true)
    setError('')
    setResult(null)

    const res = await fetch('/api/grade', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ title, tags, description, price }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to grade'); setGrading(false); return }
    setResult(data)
    setGrading(false)
  }

  const oc = result ? (GRADE_COLORS[result.overallGrade] || GRADE_COLORS['C']) : null

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Listing grader</h1>
        <p className="text-xs text-neutral-400 mt-1">Get a detailed score for your title, tags, description, and pricing with specific fixes</p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Listing title <span className="font-normal text-neutral-400">(required)</span></label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Personalized Wood Sign, Custom Kitchen Decor, Housewarming Gift"
            maxLength={500}
            className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-black transition-colors"
          />
          <p className="text-xs text-neutral-400 mt-1">{title.length}/140 chars {title.length > 140 ? '— Etsy truncates at 140' : ''}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Tags <span className="font-normal text-neutral-400">(comma separated, 13 max)</span></label>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="personalized sign, wood wall art, kitchen decor, housewarming gift..."
            className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-black transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Description <span className="font-normal text-neutral-400">(optional but recommended)</span></label>
          <textarea
            value={description}
            onChange={e => setDesc(e.target.value)}
            placeholder="Paste your listing description..."
            rows={5}
            maxLength={3000}
            className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-black transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Price <span className="font-normal text-neutral-400">(optional)</span></label>
          <input
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="e.g. 29.99"
            maxLength={50}
            className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-black transition-colors"
          />
        </div>

        <button
          onClick={grade}
          disabled={grading || (!title && !description)}
          className="w-full py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {grading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round"/>
              </svg>
              Grading…
            </>
          ) : 'Grade my listing →'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-600">{error}</div>}

      {result && (
        <div className="space-y-4">
          {/* Overall */}
          <div className={`rounded-2xl border-2 ${oc?.border} p-6 flex items-center gap-6`}>
            <div className={`w-20 h-20 rounded-2xl ${oc?.bg} border-2 ${oc?.border} flex flex-col items-center justify-center flex-shrink-0`}>
              <span className={`text-4xl font-black ${oc?.text}`}>{result.overallGrade}</span>
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wide font-semibold mb-1">Overall score</p>
              <p className={`text-5xl font-black ${oc?.text}`}>{result.overallScore}<span className="text-lg text-neutral-400 font-normal">/100</span></p>
            </div>
          </div>

          <GradeCard label="Title"       data={result.title}       />
          <GradeCard label="Tags"        data={result.tags}        />
          <GradeCard label="Description" data={result.description} />
          {result.pricing && <GradeCard label="Pricing" data={result.pricing} />}

          <button
            onClick={grade}
            disabled={grading}
            className="w-full py-3 border border-neutral-200 text-sm text-neutral-600 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Re-grade →
          </button>
        </div>
      )}
    </div>
  )
}
