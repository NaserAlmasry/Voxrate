'use client'

// ============================================================
// app/dashboard/report/[id]/page.tsx
//
// FIXES IN THIS VERSION:
//  [BUG#1] fr scope crash on PDF: fr promoted to useMemo so
//          handlePrint() can close over it — was undefined at
//          call time because fr was declared after the function.
//  [BUG#2] normalised object was built then ignored: fr IIFE
//          now spreads `normalised`, not `rawReport`, so the
//          Array.isArray guards actually protect the render.
//  [BUG#3] starBreakdown: rendered as counts + % with bar.
//  [BUG#4] analyses_count: queried from users table (correct).
//  [SEC#1] Admin email: checked via Supabase is_admin column,
//          not a hardcoded array in the client bundle.
//  [SEC#2] Simulate bypass: gated on isAdmin === true from DB.
//          Single consolidated Supabase call in init() —
//          eliminates race condition from the double-call pattern.
//  [UX#1]  SEO tab shows empty state (not paywall) for paid
//          users when the SEO call returned no data.
//  [UX#2]  Emoji removed from admin bar and empty states.
//  [UX#3]  Loading timer uses Date.now() diff, not pollCount*3.
// ============================================================

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/app/components/Toast'

const SIMULATE_USER_KEY = 'voxrate_simulate_user'
const FREE_PLAN_LIMIT   = 3   // change here if the limit ever changes

// ── Pure helpers ──────────────────────────────────────────────

function scoreColor(n: number) {
  if (n <= 37) return { text: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-100',    hex: '#ef4444' }
  if (n <= 65) return { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100', hex: '#f05a1e' }
  return               { text: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100',  hex: '#22c55e' }
}

function severityConfig(s: string) {
  switch (s?.toUpperCase()) {
    case 'CRITICAL': return { label: 'Critical', bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500',    hex: '#ef4444', lightBg: '#fee2e2', borderHex: '#fca5a5' }
    case 'MEDIUM':   return { label: 'Medium',   bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', hex: '#f05a1e', lightBg: '#ffedd5', borderHex: '#fdba74' }
    default:         return { label: 'Low',       bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-400', hex: '#eab308', lightBg: '#fefce8', borderHex: '#fde68a' }
  }
}

function safeArray(v: any): any[]  { return Array.isArray(v) ? v : [] }
function safeStr(v: any, fb = '—'): string { return typeof v === 'string' && v.trim() ? v : fb }

// Escape HTML special chars before injecting LLM content into PDF HTML.
// Prevents XSS via malicious Etsy review text copied verbatim by the LLM.
function esc(v: any, fb = '—'): string {
  const s = safeStr(v, fb)
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ── PDF builder ───────────────────────────────────────────────

function buildPrintHTML(report: any, fr: any): string {
  const sc = scoreColor(report.health_score || 0)

  const seoHTML = fr.seo ? (() => {
    const seo = fr.seo
    const keywordsHTML = safeArray(seo.keywords).map((k: any) => `
      <div style="margin-bottom:8px;padding:10px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;page-break-inside:avoid;">
        <div style="font-size:12px;font-weight:700;color:#0369a1;">${esc(typeof k === 'string' ? k : k.keyword)}</div>
        ${k.usage ? `<div style="font-size:11px;color:#374151;margin-top:3px;">${esc(k.usage)}</div>` : ''}
      </div>`).join('')
    return `
      <div style="margin-bottom:8px;padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
        <span style="font-size:11px;font-weight:700;color:#166534;">SEO Score: ${seo.score ?? '—'}/100</span>
        ${seo.summary ? `<div style="font-size:11px;color:#374151;margin-top:4px;">${esc(seo.summary)}</div>` : ''}
      </div>
      ${keywordsHTML}`
  })() : ''

  const marketingHTML = safeArray(fr.marketingCopy).map((m: any, i: number) => `
    <div style="margin-bottom:10px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;page-break-inside:avoid;">
      <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px;">Option ${i + 1}</div>
      <div style="font-size:12px;color:#111;line-height:1.6;">${esc(typeof m === 'string' ? m : m.copy || m.text || m.content)}</div>
    </div>`).join('')

  const templatesHTML = safeArray(fr.reviewTemplates).map((t: any, i: number) => `
    <div style="margin-bottom:10px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;page-break-inside:avoid;">
      <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px;">Template ${i + 1}</div>
      <div style="font-size:11px;color:#374151;line-height:1.7;font-style:italic;">${esc(typeof t === 'string' ? t : t.template || t.text || t.content)}</div>
    </div>`).join('')

  const complaintsHTML = safeArray(fr.complaints).map((c: any) => {
    const sev      = severityConfig(c.severity)
    const fixesHTML = safeArray(c.fixes).map((fix: any, fi: number) => `
      <div style="margin-bottom:8px;padding:10px 12px;background:#f9fafb;border-radius:8px;border-left:3px solid #e5e7eb;">
        <div style="font-size:11px;font-weight:600;color:#111;margin-bottom:3px;">Fix ${fi + 1}</div>
        ${fix.simpleFix   ? `<div style="font-size:11px;color:#374151;margin-bottom:4px;"><strong>Simple:</strong> ${esc(fix.simpleFix)}</div>`   : ''}
        ${fix.advancedFix ? `<div style="font-size:11px;color:#6b7280;"><strong>Expert:</strong> ${esc(fix.advancedFix)}</div>`                   : ''}
        ${fix.why         ? `<div style="font-size:10px;color:#9ca3af;margin-top:3px;font-style:italic;">${esc(fix.why)}</div>`                   : ''}
      </div>`).join('')
    return `
      <div style="margin-bottom:14px;padding:14px;border:2px solid ${sev.borderHex};border-radius:10px;background:#fff;page-break-inside:avoid;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:${sev.lightBg};color:${sev.hex};">${sev.label}</span>
          <span style="font-size:10px;color:#9ca3af;">${esc(c.frequency)}</span>
        </div>
        <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:4px;">${esc(c.title)}</div>
        <div style="font-size:11px;color:#374151;line-height:1.6;margin-bottom:6px;">${esc(c.description)}</div>
        ${c.quote         ? `<div style="font-size:11px;color:#6b7280;font-style:italic;padding:6px 10px;border-left:3px solid #e5e7eb;margin-bottom:8px;">&ldquo;${esc(c.quote)}&rdquo;</div>` : ''}
        ${c.revenueImpact ? `<div style="font-size:11px;padding:8px 10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;color:#9a3412;margin-bottom:6px;">${esc(c.revenueImpact)}</div>` : ''}
        ${c.riskIfIgnored ? `<div style="font-size:11px;padding:8px 10px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;color:#991b1b;margin-bottom:8px;">If ignored: ${esc(c.riskIfIgnored)}</div>` : ''}
        ${fixesHTML       ? `<div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">How to fix</div>${fixesHTML}` : ''}
      </div>`
  }).join('')

  const strengthsHTML = safeArray(fr.strengths).map((s: any) => `
    <div style="margin-bottom:12px;padding:14px;border:2px solid #bbf7d0;border-radius:10px;background:#fff;page-break-inside:avoid;">
      <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:6px;">${esc(s.title)}</div>
      ${s.quote          ? `<div style="font-size:11px;color:#6b7280;font-style:italic;padding:6px 10px;border-left:3px solid #86efac;margin-bottom:8px;">&ldquo;${esc(s.quote)}&rdquo;</div>` : ''}
      ${s.marketingAngle ? `<div style="font-size:11px;padding:8px 10px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;color:#166534;"><strong>Use in listing:</strong> &ldquo;${esc(s.marketingAngle)}&rdquo;</div>` : ''}
    </div>`).join('')

  const improvementsHTML = safeArray(fr.improvements).map((imp: any) => `
    <div style="margin-bottom:10px;padding:12px;border:2px solid #bfdbfe;border-radius:10px;background:#fff;page-break-inside:avoid;">
      <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:4px;">${esc(imp.title)}</div>
      <div style="font-size:11px;color:#374151;line-height:1.6;">${esc(imp.description)}</div>
    </div>`).join('')

  const topActionsHTML = safeArray(fr.topActions).map((a: any, i: number) => {
    const title  = typeof a === 'object' ? esc(a.action) : esc(String(a))
    const detail = typeof a === 'object' ? a.detail : null
    return `
      <div style="margin-bottom:8px;padding:12px;border:1px solid #292524;border-radius:8px;background:#1c1917;page-break-inside:avoid;">
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <span style="width:20px;height:20px;background:#f05a1e;border-radius:999px;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;text-align:center;line-height:20px;">${i + 1}</span>
          <div>
            <div style="font-size:12px;font-weight:700;color:#fff;">${title}</div>
            ${detail ? `<div style="font-size:11px;color:#d6d3d1;margin-top:6px;line-height:1.6;">${esc(detail)}</div>` : ''}
          </div>
        </div>
      </div>`
  }).join('')

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#111;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #f05a1e;margin-bottom:20px;">
        <div>
          <div style="font-size:24px;font-weight:900;color:#111;">Voxrate</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:2px;">AI Review Intelligence Report · ${new Date(report.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <div style="text-align:center;padding:10px 16px;background:${sc.hex}15;border:2px solid ${sc.hex}50;border-radius:12px;">
          <div style="font-size:10px;color:#9ca3af;margin-bottom:2px;">Health Score</div>
          <div style="font-size:28px;font-weight:900;color:${sc.hex};line-height:1;">${report.health_score}<span style="font-size:14px;color:#9ca3af;">/100</span></div>
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:18px;font-weight:800;color:#111;margin-bottom:4px;">${esc(report.product_name)}</div>
        <div style="font-size:11px;color:#9ca3af;">${report.total_reviews_analyzed} reviews analyzed</div>
      </div>
      ${fr.summary    ? `<div style="padding:14px;background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:20px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:6px;">Executive Summary</div><div style="font-size:12px;color:#374151;line-height:1.7;">${esc(fr.summary)}</div></div>` : ''}
      ${fr.quickWin   ? `<div style="padding:14px;background:#f05a1e;border-radius:10px;margin-bottom:20px;color:#fff;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;opacity:0.8;margin-bottom:6px;">Quick Win — Do This Today</div><div style="font-size:13px;font-weight:700;">${esc(fr.quickWin.action)}</div></div>` : ''}
      ${safeArray(fr.topActions).length  > 0 ? `<div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:800;color:#111;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #f05a1e;">Top 3 Actions</div><div style="background:#111;padding:12px;border-radius:10px;">${topActionsHTML}</div></div>` : ''}
      ${safeArray(fr.complaints).length  > 0 ? `<div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:800;color:#111;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #f05a1e;">Problems Found (${safeArray(fr.complaints).length})</div>${complaintsHTML}</div>` : ''}
      ${safeArray(fr.strengths).length   > 0 ? `<div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:800;color:#111;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #f05a1e;">Strengths (${safeArray(fr.strengths).length})</div>${strengthsHTML}</div>` : ''}
      ${safeArray(fr.improvements).length  > 0 ? `<div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:800;color:#111;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #f05a1e;">Improvements (${safeArray(fr.improvements).length})</div>${improvementsHTML}</div>` : ''}
      ${fr.seo && seoHTML ? `<div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:800;color:#111;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #f05a1e;">SEO Analysis</div>${seoHTML}</div>` : ''}
      ${safeArray(fr.marketingCopy).length  > 0 ? `<div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:800;color:#111;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #f05a1e;">Marketing Copy</div>${marketingHTML}</div>` : ''}
      ${safeArray(fr.reviewTemplates).length > 0 ? `<div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:800;color:#111;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #f05a1e;">Review Response Templates</div>${templatesHTML}</div>` : ''}
      <div style="margin-top:30px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
        <div style="font-size:11px;color:#9ca3af;">Generated by <strong style="color:#f05a1e;">Voxrate</strong> · voxrate.app</div>
      </div>
    </div>`
}

// ── Section skeleton ──────────────────────────────────────────

function SectionSkeleton({ label, message }: { label: string; message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center space-y-4">
      <div className="flex items-center justify-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <div>
        <p className="text-sm font-semibold text-neutral-700">{label} loading</p>
        <p className="text-xs text-neutral-400 mt-1">{message}</p>
      </div>
      <div className="space-y-2 opacity-30 pointer-events-none select-none">
        {[90, 75, 60].map((w, i) => (
          <div key={i} className="h-12 bg-neutral-100 rounded-xl animate-pulse" style={{ width: `${w}%`, margin: '0 auto' }} />
        ))}
      </div>
    </div>
  )
}

// ── Upgrade CTA ───────────────────────────────────────────────

const UpgradeBanner = () => (
  <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-2xl p-5 border border-neutral-700">
    <div className="flex items-start gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-white mb-1">You&apos;re seeing the core problems.</p>
        <p className="text-xs text-neutral-400 leading-relaxed">Paid plan includes exact fixes, keyword strategy, and conversion improvements.</p>
      </div>
      <a href="/#pricing" className="flex-shrink-0 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap">
        Unlock all →
      </a>
    </div>
  </div>
)

// ── Locked feature ────────────────────────────────────────────

const LOCKED_PREVIEWS: Record<string, string[]> = {
  'Improvement roadmap':          ['Add a size comparison photo next to a common object', 'Rewrite your first listing photo caption using buyer language', 'Pin your most helpful 5-star review to the top'],
  'SEO analysis & Magic Keywords': ['handmade ceramic mug gift', 'pottery coffee cup unique', 'microwave safe stoneware'],
  'Marketing copy generator':      ['"Crafted for the coffee lover who notices the details."', '"Ships in protective packaging — arrives ready to gift."'],
  'Full star breakdown analysis':  ['5★ — Buyers love the weight and finish quality', '2★ — Packaging complaints cluster around winter months'],
}

const LockedFeature = ({ label }: { label: string }) => {
  const previews = LOCKED_PREVIEWS[label] || []
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
      {previews.length > 0 && (
        <div className="p-5 relative">
          <div className="space-y-2 blur-sm pointer-events-none select-none opacity-70">
            {previews.map((p, i) => (
              <div key={i} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                <p className="text-xs text-neutral-700">{p}</p>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-white/80 pointer-events-none" />
        </div>
      )}
      <div className="p-5 border-t border-neutral-100 text-center">
        <p className="text-sm font-bold text-neutral-800 mb-1">{label}</p>
        <p className="text-xs text-neutral-400 mb-4">Unlock with any paid plan to see your real data</p>
        <a href="/#pricing" className="inline-block px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl transition-colors">
          See pricing →
        </a>
      </div>
    </div>
  )
}

// ── Progress chart (pure SVG, no deps) ───────────────────────

function ProgressChart({ history }: { history: { date: string; score: number }[] }) {
  const W = 560, H = 120, padX = 32, padTop = 24, padBot = 18
  const scores = history.map(h => h.score)
  const min = Math.max(0,   Math.min(...scores) - 10)
  const max = Math.min(100, Math.max(...scores) + 10)
  const range = max - min || 1

  const x = (i: number) => padX + (i / (history.length - 1)) * (W - padX * 2)
  const y = (s: number) => padTop + (1 - (s - min) / range) * (H - padTop - padBot)

  const pts = history.map((h, i) => `${x(i)},${y(h.score)}`).join(' ')

  const firstScore = scores[0]
  const lastScore  = scores[scores.length - 1]
  const diff       = lastScore - firstScore
  const color      = lastScore >= 66 ? '#22c55e' : lastScore >= 38 ? '#f05a1e' : '#ef4444'

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl font-bold" style={{ color }}>{lastScore}</span>
        <span className="text-xs font-medium" style={{ color }}>
          {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '±0'} since first analysis
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[25, 50, 75].map(v => (
          <line key={v} x1={padX} x2={W - padX} y1={y(v)} y2={y(v)} stroke="#f3f4f6" strokeWidth="1" />
        ))}
        {/* Area fill */}
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${x(0)},${H - padBot} ${pts} ${x(history.length - 1)},${H - padBot}`}
          fill="url(#sg)"
        />
        {/* Line */}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots + labels */}
        {history.map((h, i) => {
          const cy = y(h.score)
          // flip label below the dot when too close to top edge
          const labelY = cy < padTop + 14 ? cy + 16 : cy - 8
          return (
            <g key={i}>
              <circle cx={x(i)} cy={cy} r="4" fill={color} />
              <text x={x(i)} y={labelY} textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="DM Sans, sans-serif">
                {h.score}
              </text>
              {(i === 0 || i === history.length - 1 || history.length <= 6) && (
                <text x={x(i)} y={H - 2} textAnchor="middle" fontSize="9" fill="#9ca3af" fontFamily="DM Sans, sans-serif">
                  {h.date}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── QuickWin card with copy button ───────────────────────────

function QuickWinCard({ quickWin, onCopy }: { quickWin: any; onCopy?: (msg: string) => void }) {
  const [copied, setCopied] = useState(false)
  const text = safeStr(quickWin.action)

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      onCopy?.('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <p className="text-xs font-semibold uppercase tracking-wider text-orange-100">Quick Win — Do This Today</p>
      </div>
      <p className="text-sm font-semibold mb-3">{text}</p>
      <div className="flex items-center gap-3 flex-wrap">
        {quickWin.impact && <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{quickWin.impact}</span>}
        {quickWin.effort && <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{quickWin.effort}</span>}
        <button
          onClick={handleCopy}
          className="ml-auto flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 transition-colors px-3 py-1 rounded-full font-medium"
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy to listing
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Improvement card with copy button ────────────────────────

function ImprovementCard({ imp, onCopy }: { imp: any; onCopy?: (msg: string) => void }) {
  const [copied, setCopied] = useState(false)
  const text = [safeStr(imp.title), safeStr(imp.description)].filter(s => s !== '—').join('\n\n')

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      onCopy?.('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-blue-100 p-5">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h3 className="font-semibold text-sm text-neutral-900">{safeStr(imp.title)}</h3>
        <button
          onClick={handleCopy}
          title="Copy to listing"
          className="flex-shrink-0 flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 transition-colors font-medium"
        >
          {copied ? (
            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
          ) : (
            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
          )}
        </button>
      </div>
      <p className="text-xs text-neutral-600 mb-3 leading-relaxed">{safeStr(imp.description)}</p>
      {imp.impact && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
          {imp.impact}
        </span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function ReportPage() {
  const toast = useToast()
  const [report, setReport]                         = useState<any>(null)
  const [loading, setLoading]                       = useState(true)
  const [error, setError]                           = useState('')
  const [activeTab, setActiveTab]                   = useState('complaints')
  const [userPlan, setUserPlan]                     = useState('free')
  const [userAnalysesCount, setUserAnalysesCount]   = useState(0)
  const [isAdmin, setIsAdmin]                       = useState(false)
  const [simulatingUser, setSimulatingUser]         = useState(false)
  const [notes, setNotes]                           = useState('')
  const [notesSaving, setNotesSaving]               = useState(false)
  const [notesSaved, setNotesSaved]                 = useState(false)
  const [notesPersisted, setNotesPersisted]         = useState(false)
  const [notesEditing, setNotesEditing]             = useState(false)
  const [expandedCards, setExpandedCards]           = useState<Set<number>>(new Set([0]))
  const [expandedTopActions, setExpandedTopActions] = useState<Set<number>>(new Set())
  const [showPdfTip, setShowPdfTip]                 = useState(false)
  const [showRating, setShowRating]                 = useState(false)
  const [ratingValue, setRatingValue]               = useState(0)
  const [ratingHover, setRatingHover]               = useState(0)
  const [ratingDone, setRatingDone]                 = useState(false)
  const [ratingFeedback, setRatingFeedback]         = useState('')
  const [ratingSubmitting, setRatingSubmitting]     = useState(false)
  const [feedbackSent, setFeedbackSent]             = useState(false)
  const [pollCount, setPollCount]                   = useState(0)
  const [isPublic, setIsPublic]                     = useState(false)
  const [shareUrl, setShareUrl]                     = useState<string | null>(null)
  const [shareCopied, setShareCopied]               = useState(false)
  const [shareLoading, setShareLoading]             = useState(false)
  const [scoreHistory, setScoreHistory]             = useState<{ date: string; score: number }[]>([])
  const [currentUserId, setCurrentUserId]           = useState<string | null>(null)
  const [showComparePicker, setShowComparePicker]   = useState(false)
  const [ownReports, setOwnReports]                 = useState<any[]>([])
  const [reanalyzing, setReanalyzing]               = useState(false)
  const [ownReportsLoading, setOwnReportsLoading]   = useState(false)
  const loadStartRef                                = useRef<number>(Date.now())
  const ratingTimerRef                              = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasIncrementedRef                           = useRef(false)
  const isMountedRef                               = useRef(true)
  // Progressive section loading
  const [sectionsReady, setSectionsReady]           = useState<string[]>([])
  const [loadingSection, setLoadingSection]         = useState<string | null>(null)
  const sectionLoadingRef                           = useRef(false)

  const params      = useParams()
  const router      = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase    = supabaseRef.current
  const reportId    = params?.id as string | undefined

  // ── Progressive section loader ────────────────────────────────
  const loadSections = useCallback(async (rId: string, alreadyReady: string[]) => {
    const SECTIONS: Array<'strengths' | 'seo' | 'summary'> = ['strengths', 'seo', 'summary']
    try {
      for (const section of SECTIONS) {
        if (alreadyReady.includes(section)) continue
        setLoadingSection(section)
        try {
          console.log(`[Section] Loading: ${section}`)
          const res  = await fetch('/api/analyze-section', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body:    JSON.stringify({ reportId: rId, section }),
          })
          const json = await res.json()
          if (res.ok && json.data) {
            const { _cache, _sectionsReady, ...cleanReport } = json.data
            setReport((prev: any) => prev ? { ...prev, full_report: cleanReport } : prev)
            setSectionsReady(json.sectionsReady || [])
            alreadyReady = json.sectionsReady || alreadyReady
            console.log(`[Section] ${section} done. Ready: ${alreadyReady.join(', ')}`)
          } else {
            console.error(`[Section] ${section} failed:`, json.error)
          }
        } catch (err) {
          console.error(`[Section] ${section} threw:`, err)
        }
      }
    } finally {
      setLoadingSection(null)
      sectionLoadingRef.current = false
      console.log('[Section] All sections loaded')
    }
  }, [])

  const resumeAnalysis = useCallback(() => {
    if (!reportId || sectionLoadingRef.current) return
    sectionLoadingRef.current = true
    loadSections(reportId, sectionsReady)
  }, [reportId, sectionsReady, loadSections])

  // ── Load report (defined before effects so closure is always valid) ──
  const loadReport = useCallback(async (retries: number) => {
    console.log('[Report] loadReport called — reportId:', reportId, 'retries:', retries)
    if (!reportId) {
      console.warn('[Report] loadReport: reportId is empty, aborting')
      setLoading(false)
      return
    }
    try {
      console.log('[Report] querying Supabase for report...')
      // Fetch via API so plan limits are enforced server-side.
      // Direct Supabase client fetch would send full paid data to free users.
      const res = await fetch(`/api/report/${reportId}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      const data = res.ok ? await res.json() : null
      const dbError = res.ok ? null : { message: `HTTP ${res.status}` }

      console.log('[Report] query result — data:', !!data, 'status:', res.status)

      if (!res.ok || !data) {
        console.error('[Report] not found or error:', dbError?.message)
        setError('Report not found')
        setLoading(false)
        return
      }
      console.log('[Report] status:', data.status)
      if (data.status === 'pending') {
        if (retries >= 100) { setError('Analysis is taking too long. Please try again.'); setLoading(false); return }
        setPollCount(retries + 1)
        setTimeout(() => loadReport(retries + 1), 3000)
        return
      }
      if (data.status === 'failed') { setError('Analysis failed. Please try again.'); setLoading(false); return }

      console.log('[Report] status:', data.status, '— full_report keys:', Object.keys(data.full_report || {}))
      console.log('[Report] complaints count:', (data.full_report?.complaints || []).length)

      const ready: string[] = data.full_report?._sectionsReady || []
      if (data.status === 'completed') {
        // Strip internal cache fields before rendering
        const { _cache, _sectionsReady, ...cleanReport } = data.full_report || {}
        setReport({ ...data, full_report: cleanReport })
        setSectionsReady(['complaints', 'strengths', 'seo', 'summary'])
        // Show rating prompt 8 seconds after report loads
        ;(async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { data: existingRating } = await supabase
                .from('ratings')
                .select('id')
                .eq('user_id', user.id)
                .limit(1)
                .single()
              if (existingRating) return // already rated — never show again
            }
          } catch {}
          if (!isMountedRef.current) return
          // Check dismiss cadence
          const dismissCount        = parseInt(localStorage.getItem('voxrate_dismiss_count') || '0')
          const lastDismissAnalysis = parseInt(localStorage.getItem('voxrate_dismiss_at_analysis') || '0')
          const totalAnalyses       = parseInt(localStorage.getItem('voxrate_analysis_count') || '0')
          const analysesSinceDismiss = totalAnalyses - lastDismissAnalysis
          const shouldShow = dismissCount === 0 || analysesSinceDismiss >= 10
          // Only increment counter when we actually intend to (possibly) show the prompt
          // Guard against incrementing multiple times in the same session (e.g. re-renders)
          if (shouldShow && !hasIncrementedRef.current) {
            hasIncrementedRef.current = true
            localStorage.setItem('voxrate_analysis_count', String(totalAnalyses + 1))
            ratingTimerRef.current = setTimeout(() => {
              if (isMountedRef.current) setShowRating(true)
            }, 8000)
          }
        })()
      } else {
        // Partial — show complaints now, load rest progressively
        // Skip section loading for free/limited reports — they use a single-call flow
        setReport(data)
        setSectionsReady(ready.length > 0 ? ready : ['complaints'])
        const isLimitedReport = data.full_report?._isLimited === true
        if (!sectionLoadingRef.current && !isLimitedReport) {
          sectionLoadingRef.current = true
          loadSections(data.id, ready)
        }
      }
      setLoading(false)
    } catch (err) {
      console.error('[Report] loadReport threw:', err)
      setError('Failed to load report')
      setLoading(false)
    }
  }, [reportId, supabase])

  // [SEC#1 + SEC#2] Single consolidated Supabase call — no race condition
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data } = await supabase
        .from('users')
        .select('plan, analyses_count, is_admin')
        .eq('id', user.id)
        .single()

      const plan      = data?.plan           || 'free'
      const count     = data?.analyses_count || 0
      const adminFlag = data?.is_admin === true

      setUserPlan(plan)
      setUserAnalysesCount(count)
      setIsAdmin(adminFlag)

      if (adminFlag) {
        const sim = localStorage.getItem(SIMULATE_USER_KEY)
        if (sim === 'true') setSimulatingUser(true)
      } else {
        localStorage.removeItem(SIMULATE_USER_KEY)
        setSimulatingUser(false)
      }
    }
    init()
    return () => {
      isMountedRef.current = false
      if (ratingTimerRef.current) clearTimeout(ratingTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (report?.notes && !notes) {
      setNotes(report.notes)
      setNotesSaved(true)
      setNotesPersisted(true)
      setNotesEditing(false)
    }
    if (report) {
      setIsPublic(report.is_public === true)
      if (report.is_public) {
        const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
        setShareUrl(`${SITE_URL}/report/${report.id}`)
      }
    }
  }, [report])

  // Load score history for progress chart (all reports for same product URL)
  useEffect(() => {
    if (!report?.product_url || report.product_url.startsWith('csv:')) return
    const loadHistory = async () => {
      const { data } = await supabase
        .from('reports')
        .select('health_score, created_at')
        .eq('product_url', report.product_url)
        .eq('status', 'completed')
        .eq('user_id', currentUserId!)
        .order('created_at', { ascending: true })
      if (data && data.length > 1) {
        setScoreHistory(data.map((r: any) => ({
          date:  new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          score: r.health_score || 0,
        })))
      }
    }
    if (!currentUserId) return
    loadHistory()
  }, [report?.product_url, currentUserId])

  useEffect(() => {
    console.log('[Report] reportId effect fired — reportId:', reportId)
    if (!reportId) {
      console.warn('[Report] reportId is falsy, not loading')
      return
    }
    loadStartRef.current = Date.now()
    loadReport(0)
  }, [reportId, loadReport])

  const toggleShare = async () => {
    if (!reportId) return
    if (!isPublic && !window.confirm('Make this report publicly visible? Anyone with the link will be able to view it.')) return
    setShareLoading(true)
    const next = !isPublic
    const res  = await fetch(`/api/report/${reportId}/share`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ public: next }),
    })
    const data = await res.json()
    if (res.ok) {
      setIsPublic(next)
      setShareUrl(next ? data.shareUrl : null)
    } else {
      toast('Failed to update share settings. Please try again.', 'error')
    }
    setShareLoading(false)
  }

  const handleReanalyze = async () => {
    if (!report?.product_url || reanalyzing) return
    setReanalyzing(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ productUrl: report.product_url, reportType: report.report_type || 'own' }),
      })
      const data = await res.json()
      if (res.ok && data.reportId) {
        router.push(`/dashboard/report/${data.reportId}`)
      } else {
        toast(data.error || 'Re-analysis failed. Please try again.', 'error')
        setReanalyzing(false)
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error')
      setReanalyzing(false)
    }
  }

  const openComparePicker = async () => {
    setShowComparePicker(true)
    if (ownReports.length > 0) return
    setOwnReportsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setOwnReportsLoading(false); return }
    const { data } = await supabase
      .from('reports')
      .select('id, product_name, health_score, created_at')
      .eq('status', 'completed')
      .eq('user_id', user.id)
      .or('report_type.eq.own,report_type.is.null')
      .order('created_at', { ascending: false })
      .limit(20)
    setOwnReports(data || [])
    setOwnReportsLoading(false)
  }

  const copyShareUrl = () => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
      .then(() => { setShareCopied(true); toast('Share link copied!'); setTimeout(() => setShareCopied(false), 2000) })
      .catch(() => toast('Copy failed — please copy the link manually', 'error'))
  }

  const saveNotes = async () => {
    setNotesSaving(true)
    const { error } = await supabase.from('reports').update({ notes }).eq('id', reportId).eq('user_id', currentUserId!)
    setNotesSaving(false)
    if (error) {
      toast('Failed to save notes. Please try again.', 'error')
      return
    }
    setNotesSaved(true)
    setNotesPersisted(true)
    setTimeout(() => setNotesSaved(false), 2500)
  }

  // [BUG#1] fr is computed via useMemo so handlePrint can close over it safely
  const rawReport = report?.full_report || {}

  const effectiveAdmin = isAdmin && !simulatingUser
  const effectivePlan  = simulatingUser ? 'free' : userPlan

  // [BUG#2] normalised now actually used in fr — Array.isArray guards protect the render
  const normalised = useMemo(() => ({
    ...rawReport,
    complaints:      Array.isArray(rawReport.complaints)      ? rawReport.complaints      : [],
    strengths:       Array.isArray(rawReport.strengths)       ? rawReport.strengths       : [],
    improvements:    Array.isArray(rawReport.improvements)    ? rawReport.improvements    : [],
    marketingCopy:   Array.isArray(rawReport.marketingCopy)   ? rawReport.marketingCopy   : [],
    reviewTemplates: Array.isArray(rawReport.reviewTemplates) ? rawReport.reviewTemplates : [],
    topActions:      Array.isArray(rawReport.topActions)      ? rawReport.topActions      : [],
  }), [rawReport])

  const fr = useMemo(() => {
    if (effectiveAdmin)              return { ...normalised, _isLimited: false }
    if (effectivePlan === 'pro')     return { ...normalised, _isLimited: false }
    if (effectivePlan === 'growth')  return { ...normalised, _isLimited: false }
    if (effectivePlan === 'starter') return { ...normalised, _isLimited: false }
    return {
      ...normalised,
      complaints:      normalised.complaints.slice(0, 2),
      strengths:       normalised.strengths.slice(0, 1),
      improvements:    [],
      marketingCopy:   [],
      reviewTemplates: [],
      seo:             normalised.seo ? { score: normalised.seo.score } : null,
      _isLimited:      true,
    }
  }, [normalised, effectiveAdmin, effectivePlan])

  // handlePrint can now safely reference fr because it's in scope as a memo
  const handlePrint = useCallback(() => {
    if (!report || !fr) return
    const printWindow = window.open('', '_blank', 'width=900,height=1200')
    if (!printWindow) { toast('Pop-up blocked — please allow pop-ups for this site and try again.', 'error'); return }
    const printContent = buildPrintHTML(report, fr)
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Voxrate Report — ${safeStr(report.product_name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #111; padding: 24px; background: #fff; }
    @page { size: A4; margin: 12mm; }
  </style>
</head>
<body>${printContent}</body>
</html>`)
    printWindow.document.close()
    printWindow.focus()
    printWindow.onload = () => { printWindow.print(); printWindow.close() }
  }, [report, fr])

  const toggleCard = (i: number) => {
    setExpandedCards(prev => {
      const n = new Set(prev)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })
  }

  const isLimited = fr._isLimited === true
  const isPro     = effectiveAdmin || effectivePlan === 'pro'
  const sc        = scoreColor(report?.health_score || 0)
  const readySections = isLimited
    ? Array.from(new Set([...sectionsReady, 'complaints', 'strengths', 'seo', 'summary']))
    : sectionsReady

  // [BUG#4] Use real count from users table — not a non-existent column
  const analysesRemaining = Math.max(0, FREE_PLAN_LIMIT - userAnalysesCount)

  // ── Loading state ─────────────────────────────────────────

  if (loading) {
    // [UX#3] elapsed time from a ref, not pollCount * assumed 3s
    const secs = Math.floor((Date.now() - loadStartRef.current) / 1000)
    const msg  = secs < 20  ? 'Voxrate is reading your reviews...'
               : secs < 60  ? 'Surfacing the complaints that cost you sales...'
               : secs < 120 ? 'Ranking what to fix first...'
               : secs < 180 ? 'Finding patterns across your reviews...'
               : 'Turning your reviews into an action plan...'
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <svg className="animate-spin w-12 h-12 text-orange-500 mx-auto mb-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <h2 className="text-xl font-semibold mb-2">Analyzing your product...</h2>
        <p className="text-sm text-neutral-500 mb-1">{msg}</p>
        <p className="text-xs text-neutral-400 mb-4">Most products take less than 4 minutes</p>
        {pollCount > 5 && (
          <div className="max-w-xs mx-auto h-1 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-400 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min((secs / 240) * 100, 92)}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  if (error) return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <p className="text-red-500 font-medium mb-4">{error}</p>
      <button onClick={() => router.push('/dashboard')} className="px-4 py-2 bg-black text-white text-sm rounded-xl">
        Back to dashboard
      </button>
    </div>
  )

  if (!report) return null

  const ALL_TABS = [
    { id: 'complaints',   label: 'Problems',       icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
    { id: 'strengths',    label: 'Strengths',      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
    { id: 'improvements', label: 'Improvements',   icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg> },
    { id: 'seo',          label: 'SEO',            icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
    { id: 'marketing',    label: 'Marketing copy', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
    { id: 'breakdown',    label: 'Star breakdown', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  ]
  const TABS = isLimited
    ? ALL_TABS.filter(t => ['complaints', 'strengths', 'seo'].includes(t.id))
    : ALL_TABS

  return (
    <>
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Low review count warning */}
      {report.total_reviews_analyzed < 30 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Limited data:</strong> This listing has {report.total_reviews_analyzed} reviews.
            {report.total_reviews_analyzed < 15
              ? ' Results may be unreliable — patterns are harder to detect with fewer than 15 reviews.'
              : ' Results are usable but more reviews will make patterns clearer. Best results with 30+ reviews.'}
          </p>
        </div>
      )}

      {/* Resume partial analysis */}
      {report.status === 'partial' && !loadingSection && !isLimited && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs text-amber-800">Some sections did not finish loading.</p>
          <button
            onClick={resumeAnalysis}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
          >
            Resume analysis
          </button>
        </div>
      )}

      {/* Admin bar — [UX#2] no emoji */}
      {isAdmin && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${simulatingUser ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className={`text-xs font-medium ${simulatingUser ? 'text-blue-700' : 'text-orange-700'}`}>
            {simulatingUser ? 'User view active' : 'Admin mode — full access'}
          </p>
          <button
            onClick={() => {
              const next = !simulatingUser
              setSimulatingUser(next)
              localStorage.setItem(SIMULATE_USER_KEY, String(next))
            }}
            className="ml-auto text-xs underline opacity-60 hover:opacity-100"
          >
            {simulatingUser ? 'Exit user view' : 'Simulate user view'}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <button onClick={() => router.push('/dashboard')} className="text-xs text-neutral-400 hover:text-black mb-2 flex items-center gap-1">
            ← Back to dashboard
          </button>
          <h1 className="text-lg font-semibold leading-tight truncate">{safeStr(report.product_name, 'Amazon Product')}</h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            {report.total_reviews_analyzed} reviews analyzed · {new Date(report.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Re-analyze button — only on URL-based own reports */}
          {report.report_type !== 'competitor' && report.product_url && !report.product_url.startsWith('csv:') && (
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="px-3 py-2 text-xs font-medium border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Re-analyze this listing to get fresh data (costs 20 credits)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              {reanalyzing ? 'Starting…' : 'Re-analyze · 20cr'}
            </button>
          )}

          {/* Compare button — only on competitor reports */}
          {report.report_type === 'competitor' && (
            <button
              onClick={openComparePicker}
              className="px-3 py-2 text-xs font-medium border border-purple-300 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition-colors flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              Compare with mine
            </button>
          )}

          {/* Share button */}
          <div className="relative">
            <button
              onClick={toggleShare}
              disabled={shareLoading}
              className={`px-3 py-2 text-xs font-medium border rounded-xl transition-colors flex items-center gap-1.5 ${isPublic ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100' : 'border-neutral-200 hover:bg-neutral-50'}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              {isPublic ? 'Shared' : 'Share'}
            </button>
          </div>

          {!isLimited && (
            <div className="relative">
              <button
                onClick={handlePrint}
                onMouseEnter={() => setShowPdfTip(true)}
                onMouseLeave={() => setShowPdfTip(false)}
                className="px-3 py-2 text-xs font-medium border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Save as PDF
              </button>
              {showPdfTip && (
                <div className="absolute right-0 top-10 w-52 bg-black text-white text-xs rounded-xl p-3 z-50 shadow-xl">
                  <p className="font-semibold mb-2">For best PDF quality:</p>
                  <p className="mb-1">Enable Background graphics</p>
                  <p>Uncheck Headers and footers</p>
                  <div className="absolute -top-1.5 right-4 w-3 h-3 bg-black rotate-45" />
                </div>
              )}
            </div>
          )}
          <div className={`text-center px-4 py-2 rounded-xl border ${sc.bg} ${sc.border}`}>
            <p className="text-xs text-neutral-400">Health</p>
            <p className={`text-2xl font-bold ${sc.text}`}>
              {report.health_score}<span className="text-sm text-neutral-400">/100</span>
            </p>
            {scoreHistory.length >= 2 && (() => {
              const prev = scoreHistory[scoreHistory.length - 2].score
              const curr = report.health_score
              const delta = curr - prev
              if (delta === 0) return null
              return (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold mt-0.5 ${delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {delta > 0 ? (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>
                  ) : (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
                  )}
                  {Math.abs(delta)} vs last
                </span>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Share link bar */}
      {isPublic && shareUrl && (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <p className="text-xs text-blue-700 flex-1 truncate font-mono">{shareUrl}</p>
          <button
            onClick={copyShareUrl}
            className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            {shareCopied ? 'Copied!' : 'Copy link'}
          </button>
          <button
            onClick={toggleShare}
            className="text-xs text-blue-500 hover:text-blue-800 flex-shrink-0 underline"
          >
            Stop sharing
          </button>
        </div>
      )}

      {/* Compare picker modal */}
      {showComparePicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowComparePicker(false)}>
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold">Select your product</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Choose which of your listings to compare against</p>
              </div>
              <button onClick={() => setShowComparePicker(false)} className="text-neutral-400 hover:text-black">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {ownReportsLoading ? (
              <div className="py-8 text-center">
                <svg className="animate-spin w-6 h-6 text-orange-500 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83"/>
                </svg>
              </div>
            ) : ownReports.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-neutral-400 mb-3">No own products analyzed yet</p>
                <a href="/dashboard" className="text-xs text-orange-600 font-medium hover:underline">Analyze your listing first →</a>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {ownReports.map(r => {
                  const sc = r.health_score <= 37 ? 'text-red-500' : r.health_score <= 65 ? 'text-orange-500' : 'text-green-500'
                  return (
                    <button
                      key={r.id}
                      onClick={() => { setShowComparePicker(false); router.push(`/dashboard/compare?own=${r.id}&competitor=${reportId}`) }}
                      className="w-full flex items-center justify-between gap-3 p-3 border border-neutral-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.product_name || 'Unnamed product'}</p>
                        <p className="text-xs text-neutral-400">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-lg font-bold flex-shrink-0 ${sc}`}>{r.health_score}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress chart — only when re-analyzed 2+ times */}
      {scoreHistory.length >= 2 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Health score over time</p>
            <span className="text-xs text-neutral-400">{scoreHistory.length} analyses</span>
          </div>
          <ProgressChart history={scoreHistory} />
        </div>
      )}

      {/* Quick Win — paid only */}
      {!isLimited && fr.quickWin && (
        <QuickWinCard quickWin={fr.quickWin} onCopy={toast} />
      )}

      {/* Top Actions — paid only */}
      {!isLimited && safeArray(fr.topActions).length > 0 && (
        <div className="bg-black text-white rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Top 3 actions to take now</p>
          <div className="space-y-2">
            {safeArray(fr.topActions).map((action: any, i: number) => {
              const isObj   = action !== null && typeof action === 'object'
              const title   = isObj ? String(action.action || '') : String(action || '')
              const detail  = isObj ? (action.detail  || null) : null
              const segment = isObj ? (action.segment || null) : null
              return (
                <div key={i} className="border border-orange-900/20 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedTopActions(prev => {
                      const n = new Set(prev)
                      n.has(i) ? n.delete(i) : n.add(i)
                      return n
                    })}
                    className="w-full flex items-start gap-3 p-3 text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 text-white">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{title}</p>
                      {segment && <p className="text-xs text-neutral-400 mt-0.5">Affects: {segment}</p>}
                    </div>
                    {detail && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="2.5"
                        className={`flex-shrink-0 transition-transform mt-0.5 ${expandedTopActions.has(i) ? 'rotate-180' : ''}`}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    )}
                  </button>
                  {expandedTopActions.has(i) && detail && (
                    <div className="px-4 pb-4 pt-1 border-t border-orange-900/20">
                      <p className="text-xs text-neutral-300 leading-relaxed">{detail}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary card */}
      {(() => {
        const complaints   = safeArray(fr.complaints)
        const criticals    = complaints.filter((c: any) => c.severity === 'CRITICAL')
        const mediums      = complaints.filter((c: any) => c.severity === 'MEDIUM')
        const topComplaint = complaints[0]
        const topStrength  = safeArray(fr.strengths)[0]
        const breakdown    = fr.starBreakdown || {}
        const total        = [1,2,3,4,5].reduce((s: number, n: number) => s + (Number(breakdown[String(n)]) || 0), 0)
        const negCount     = (Number(breakdown['1']) || 0) + (Number(breakdown['2']) || 0)
        const negPct       = total > 0 ? Math.round((negCount / total) * 100) : 0
        const posCount     = (Number(breakdown['4']) || 0) + (Number(breakdown['5']) || 0)
        const posPct       = total > 0 ? Math.round((posCount / total) * 100) : 0

        return (
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-neutral-100">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">What this score means</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-neutral-50 rounded-xl">
                  <p className={`text-xl font-bold ${sc.text}`}>{report.health_score}<span className="text-xs text-neutral-400">/100</span></p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">Health score</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-xl">
                  <p className="text-xl font-bold text-red-500">{negPct}%</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">Unhappy buyers</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <p className="text-xl font-bold text-green-500">{posPct}%</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">Happy buyers</p>
                </div>
              </div>
            </div>

            {topComplaint && (
              <div className="px-5 py-4 border-b border-neutral-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-1.5 flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                  Biggest revenue threat
                </p>
                <p className="text-sm font-semibold text-neutral-900 mb-1">{safeStr(topComplaint.title)}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {safeStr(topComplaint.shortDescription || topComplaint.description).split('. ')[0]}.
                </p>
                {topComplaint.revenueImpact && (
                  <p className="text-xs text-red-600 font-medium mt-1.5">{topComplaint.revenueImpact}</p>
                )}
              </div>
            )}

            {topStrength && (
              <div className="px-5 py-4 border-b border-neutral-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-green-500 mb-1.5 flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                  Biggest growth opportunity
                </p>
                <p className="text-sm font-semibold text-neutral-900 mb-1">{safeStr(topStrength.title)}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {safeStr(topStrength.summary).split('. ')[0]}.
                </p>
              </div>
            )}

            <div className="px-5 py-4">
              <div className="flex items-center gap-3 flex-wrap">
                {criticals.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-100 rounded-full text-xs font-semibold text-red-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    {criticals.length} critical issue{criticals.length !== 1 ? 's' : ''}
                  </span>
                )}
                {mediums.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-full text-xs font-semibold text-orange-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                    {mediums.length} medium issue{mediums.length !== 1 ? 's' : ''}
                  </span>
                )}
                {safeArray(fr.strengths).length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-100 rounded-full text-xs font-semibold text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                    {safeArray(fr.strengths).length} strength{safeArray(fr.strengths).length !== 1 ? 's' : ''} to amplify
                  </span>
                )}
              </div>
              {(fr.summary || fr.freeSummary) && (
                <p className="text-xs text-neutral-500 leading-relaxed mt-3 pt-3 border-t border-neutral-100">
                  {isLimited
                    ? safeStr(fr.freeSummary, 'Analysis complete.')
                    : safeStr(fr.summary,     'Analysis complete.')}
                </p>
              )}
            </div>
          </div>
        )
      })()}

      {/* Key Insight — free only */}
      {isLimited && fr.keyInsight && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Key Insight</h3>
          </div>
          <p className="text-sm text-neutral-700 leading-relaxed">{safeStr(fr.keyInsight)}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {TABS.map(tab => {
          const sectionKey = tab.id === 'improvements' ? 'strengths' : tab.id === 'marketing' ? 'seo' : tab.id
          const isLoading  = loadingSection === sectionKey || (loadingSection === 'seo' && tab.id === 'marketing')
          const isReady    = tab.id === 'complaints' || readySections.includes(sectionKey)
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-black text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300'}`}
            >
              {tab.icon}
              {tab.label}
              {isLoading && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />}
              {!isReady && !isLoading && <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 flex-shrink-0" />}
            </button>
          )
        })}
        {isLimited && ['Improvements', 'Marketing copy', 'Star breakdown'].map(label => (
          <button
            key={label}
            onClick={() => { window.location.href = '/#pricing' }}
            className="px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap bg-white border border-neutral-200 text-neutral-400 flex items-center gap-1.5 opacity-60"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            {label}
          </button>
        ))}
      </div>

      {/* ── PROBLEMS TAB ──────────────────────────────────────── */}
      {activeTab === 'complaints' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {isLimited ? 'Top issues identified' : 'Problems found'}
            </h2>
            <p className="text-xs text-neutral-400">
              {safeArray(fr.complaints).length} issue{safeArray(fr.complaints).length !== 1 ? 's' : ''} identified
            </p>
          </div>

          {safeArray(fr.complaints).length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center">
              {(report.total_reviews_analyzed ?? 0) < 10 ? (
                <>
                  <p className="text-sm font-medium text-neutral-600">Not enough reviews to detect patterns</p>
                  <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                    This listing has fewer than 10 reviews analyzed. Complaint patterns need more data to surface reliably. Check back once the listing has more reviews.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-green-700">No recurring complaints detected</p>
                  <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                    Across {report.total_reviews_analyzed} reviews, no consistent complaint pattern emerged. This is a strong signal of a well-received product.
                  </p>
                </>
              )}
            </div>
          ) : (
            safeArray(fr.complaints).map((c: any, i: number) => {
              const sev        = severityConfig(c.severity)
              const isExpanded = expandedCards.has(i)
              const displayDescription = isLimited
                ? safeStr(c.shortDescription || c.description)
                : safeStr(c.description)

              return (
                <div key={i} className={`bg-white rounded-2xl border-2 ${sev.border} overflow-hidden`}>
                  <button onClick={() => toggleCard(i)} className="w-full p-5 text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sev.bg} ${sev.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                            {sev.label}
                          </span>
                          <span className="text-xs text-neutral-400">{safeStr(c.frequency)}</span>
                        </div>
                        <h3 className="font-semibold text-base text-neutral-900">{safeStr(c.title)}</h3>
                        <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{displayDescription}</p>
                        {c.quote && <p className="text-sm text-neutral-400 italic mt-2">&quot;{c.quote}&quot;</p>}
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`flex-shrink-0 text-neutral-400 transition-transform mt-1 ${isExpanded ? 'rotate-180' : ''}`}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </button>

                  {/* Free expanded: locked fixes */}
                  {isLimited && isExpanded && (
                    <div className={`px-5 pb-5 pt-0 border-t ${sev.border}`}>
                      <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-neutral-200 text-center bg-gradient-to-b from-white to-neutral-50">
                        <p className="text-sm font-bold text-neutral-800 mb-1">
                          Step-by-step fixes for &quot;{safeStr(c.title)}&quot;
                        </p>
                        <p className="text-xs text-neutral-500 mb-1 leading-relaxed">
                          Exact actions, ready-to-use wording, and effort estimates — so you know what to do today.
                        </p>
                        {c.revenueImpact && (
                          <p className="text-xs text-orange-600 font-medium mb-3">{c.revenueImpact}</p>
                        )}
                        <a href="/#pricing" className="inline-block px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl transition-colors">
                          Unlock fixes — see pricing →
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Paid expanded: full fixes */}
                  {!isLimited && isExpanded && (
                    <div className={`px-5 pb-5 pt-0 border-t ${sev.border} space-y-3`}>
                      {c.revenueImpact && (
                        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                          <p className="text-sm font-semibold text-orange-800 mb-0.5">Revenue impact</p>
                          <p className="text-sm text-orange-700 leading-relaxed">{c.revenueImpact}</p>
                        </div>
                      )}
                      {(c.riskIfIgnored || c.urgency) && (c.severity === 'CRITICAL' || c.severity === 'MEDIUM') && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                          <p className="text-sm font-semibold text-red-800 mb-0.5">If you ignore this</p>
                          <p className="text-sm text-red-700 leading-relaxed">{c.riskIfIgnored || c.urgency}</p>
                        </div>
                      )}
                      {safeArray(c.fixes).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mt-1 mb-2">How to fix this</p>
                          <div className="space-y-2.5">
                            {safeArray(c.fixes).map((fix: any, fi: number) => {
                              const simple   = safeStr(fix.simpleFix   || fix.action)
                              const advanced = safeStr(fix.advancedFix || fix.action)
                              return (
                                <div key={fi} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                  <div className="flex items-start gap-3">
                                    <span className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{fi + 1}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-neutral-800 leading-relaxed">{simple}</p>
                                      {advanced !== simple && <p className="text-sm text-neutral-500 mt-1 leading-relaxed">{advanced}</p>}
                                      {fix.why && <p className="text-sm text-neutral-400 mt-1">{fix.why}</p>}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── STRENGTHS TAB ─────────────────────────────────────── */}
      {activeTab === 'strengths' && !readySections.includes('strengths') && (
        <SectionSkeleton label="Strengths" message="Analyzing what buyers love — ready in ~30 seconds" />
      )}
      {activeTab === 'strengths' && readySections.includes('strengths') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-800">What customers love</h2>
            <p className="text-xs text-neutral-400">{isLimited ? 'Preview — 1 of several strengths' : 'Your competitive advantages'}</p>
          </div>
          {safeArray(fr.strengths).length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center">
              <p className="text-sm text-neutral-400">No strength data available.</p>
            </div>
          ) : (
            safeArray(fr.strengths).map((s: any, i: number) => (
              <div key={i} className="bg-white rounded-2xl border-2 border-green-100 p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm text-neutral-900">{safeStr(s.title)}</h3>
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">{safeStr(s.frequency)}</span>
                </div>
                {s.segment && <p className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mb-2">{s.segment}</p>}
                {s.quote && <p className="text-xs text-neutral-400 italic mb-3 border-l-2 border-green-200 pl-3">&quot;{s.quote}&quot;</p>}
                {!isLimited && (
                  <>
                    {s.summary && (
                      <div className="p-3 bg-neutral-50 rounded-xl mb-3">
                        <p className="text-xs font-semibold text-neutral-500 mb-1">Why this matters</p>
                        <p className="text-xs text-neutral-700 leading-relaxed">{s.summary}</p>
                      </div>
                    )}
                    {s.businessImpact && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl mb-3">
                        <p className="text-xs font-semibold text-amber-700 mb-0.5">Business impact</p>
                        <p className="text-xs text-neutral-600 leading-relaxed">{s.businessImpact}</p>
                      </div>
                    )}
                    {s.marketingAngle && (
                      <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                        <p className="text-xs font-semibold text-green-700 mb-1">Use in your listing</p>
                        <p className="text-xs text-neutral-700 italic">&quot;{safeStr(s.marketingAngle)}&quot;</p>
                        <button onClick={() => navigator.clipboard.writeText(s.marketingAngle).then(() => toast('Marketing phrase copied!')).catch(() => toast('Copy failed — please copy manually', 'error'))} className="mt-2 text-[10px] text-green-600 hover:underline">
                          Copy phrase →
                        </button>
                      </div>
                    )}
                  </>
                )}
                {isLimited && (
                  <div className="mt-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between gap-3">
                    <p className="text-xs text-neutral-500">Business impact, marketing angle + more strengths locked</p>
                    <a href="/#pricing" className="flex-shrink-0 text-xs text-orange-600 font-medium hover:underline whitespace-nowrap">Unlock →</a>
                  </div>
                )}
              </div>
            ))
          )}
          {isLimited && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5 text-center">
              <p className="text-sm font-semibold text-neutral-800 mb-1">
                {normalised.strengths.length > 1
                  ? `${normalised.strengths.length - 1} more strength${normalised.strengths.length - 1 > 1 ? 's' : ''} hidden`
                  : 'Full strength analysis locked'}
              </p>
              <p className="text-xs text-neutral-500 mb-3">Paid plan shows all strengths with business impact and ready-to-paste listing copy.</p>
              <a href="/#pricing" className="inline-block px-4 py-2 bg-black text-white text-xs font-medium rounded-xl hover:bg-neutral-800 transition-colors">
                See pricing →
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── IMPROVEMENTS TAB ──────────────────────────────────── */}
      {activeTab === 'improvements' && !readySections.includes('strengths') && (
        <SectionSkeleton label="Improvements" message="Building your improvement roadmap — ready in ~30 seconds" />
      )}
      {activeTab === 'improvements' && readySections.includes('strengths') && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800">Improvements</h2>
          {isLimited ? (
            <LockedFeature label="Improvement roadmap" />
          ) : safeArray(fr.improvements).length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center">
              <p className="text-sm text-neutral-400">No improvement data available.</p>
            </div>
          ) : (
            safeArray(fr.improvements).map((imp: any, i: number) => (
              <ImprovementCard key={i} imp={imp} onCopy={toast} />
            ))
          )}
        </div>
      )}

      {/* ── SEO TAB ────────────────────────────────────────────── */}
      {activeTab === 'seo' && !readySections.includes('seo') && (
        <SectionSkeleton label="SEO Analysis" message="Extracting keywords from your 5-star reviews — ready in ~20 seconds" />
      )}
      {activeTab === 'seo' && readySections.includes('seo') && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800">SEO Analysis</h2>
          {isLimited ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">SEO Score Preview</p>
                <span className={`text-2xl font-bold ${fr.seo?.score >= 70 ? 'text-green-500' : fr.seo?.score >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
                  {fr.seo?.score ?? 0}/100
                </span>
              </div>
              <LockedFeature label="SEO analysis & Magic Keywords" />
            </div>
          ) : !fr.seo ? (
            // [UX#1] Paid users see an empty state, not the paywall
            <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center">
              <p className="text-sm text-neutral-500">SEO data not available for this report</p>
              <p className="text-xs text-neutral-400 mt-1">Run a new analysis to get SEO keywords</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">SEO Score</p>
                <span className={`text-2xl font-bold ${fr.seo.score >= 70 ? 'text-green-500' : fr.seo.score >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
                  {fr.seo.score}/100
                </span>
              </div>
              {safeArray(fr.seo.magicKeywords).length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <p className="text-xs font-semibold text-yellow-800 mb-1">Magic Keywords — exact words your buyers use</p>
                  <p className="text-[10px] text-yellow-700 mb-2">Add phrases marked <span className="font-semibold text-orange-600">Missing from title</span> to your listing title or first bullet.</p>
                  <div className="flex flex-wrap gap-2">
                    {safeArray(fr.seo.keywordFlags || fr.seo.magicKeywords).map((item: any, i: number) => {
                      const phrase   = typeof item === 'string' ? item : item.phrase
                      const inTitle  = typeof item === 'string' ? null  : item.inTitle
                      return (
                        <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium ${inTitle === false ? 'bg-orange-100 text-orange-800' : inTitle === true ? 'bg-green-100 text-green-800' : 'bg-yellow-200 text-yellow-900'}`}>
                          {phrase}
                          {inTitle === false && <span className="text-[9px] font-semibold opacity-80">· missing</span>}
                          {inTitle === true  && <span className="text-[9px] opacity-60">· in title</span>}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              {safeArray(fr.seo.suggestions).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-600 mb-2">Suggestions:</p>
                  <div className="space-y-1.5">
                    {safeArray(fr.seo.suggestions).map((s: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-neutral-700 p-2 bg-blue-50 rounded-lg">
                        <span className="text-blue-500 flex-shrink-0">→</span>{s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MARKETING TAB ─────────────────────────────────────── */}
      {activeTab === 'marketing' && !readySections.includes('seo') && (
        <SectionSkeleton label="Marketing Copy" message="Building copy from your 5-star reviews — ready in ~20 seconds" />
      )}
      {activeTab === 'marketing' && readySections.includes('seo') && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800">Marketing copy</h2>
          <p className="text-xs text-neutral-500">Ready-to-paste phrases from real customer language</p>
          {isLimited ? (
            <LockedFeature label="Marketing copy generator" />
          ) : safeArray(fr.marketingCopy).length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center">
              <p className="text-sm text-neutral-400">No marketing copy generated.</p>
            </div>
          ) : (
            <>
              {safeArray(fr.marketingCopy).map((copy: string, i: number) => (
                <div key={i} className="bg-white rounded-2xl border border-purple-100 p-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-neutral-700 italic">&quot;{safeStr(copy)}&quot;</p>
                  <button onClick={() => navigator.clipboard.writeText(copy).then(() => toast('Marketing copy copied!')).catch(() => toast('Copy failed', 'error'))} className="flex-shrink-0 px-2.5 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                    Copy
                  </button>
                </div>
              ))}
              {safeArray(fr.reviewTemplates).length > 0 && (
                <div className="bg-white rounded-2xl border border-neutral-200 p-5 mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Review response templates</h3>
                  <div className="space-y-3">
                    {safeArray(fr.reviewTemplates).map((t: any, i: number) => (
                      <div key={i} className="p-3 bg-neutral-50 rounded-xl">
                        <p className="text-xs font-medium text-neutral-500 mb-1">{safeStr(t.situation)}</p>
                        <p className="text-xs text-neutral-700 leading-relaxed">{safeStr(t.template)}</p>
                        <button onClick={() => navigator.clipboard.writeText(t.template).then(() => toast('Template copied!')).catch(() => toast('Copy failed', 'error'))} className="mt-2 text-xs text-orange-600 hover:underline">
                          Copy template
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── STAR BREAKDOWN TAB ────────────────────────────────── */}
      {activeTab === 'breakdown' && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800">Review breakdown by star</h2>
          {isLimited ? (
            <LockedFeature label="Full star breakdown analysis" />
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              {/* [BUG#3] Shows count + % with progress bar — not raw integers */}
              {(() => {
                const breakdown = fr.starBreakdown || {}
                const total = [5,4,3,2,1].reduce((sum, s) => sum + (Number(breakdown[String(s)]) || 0), 0)
                return (
                  <div className="space-y-3">
                    {[5,4,3,2,1].map(star => {
                      const count    = Number(breakdown[String(star)]) || 0
                      const pct      = total > 0 ? Math.round((count / total) * 100) : 0
                      const barColor = star >= 4 ? 'bg-green-400' : star === 3 ? 'bg-yellow-400' : 'bg-red-400'
                      return (
                        <div key={star} className="flex items-center gap-3">
                          <span className="text-yellow-400 text-sm w-20 flex-shrink-0">
                            {'★'.repeat(star)}{'☆'.repeat(5 - star)}
                          </span>
                          <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-neutral-500 w-24 text-right flex-shrink-0">
                            {count} review{count !== 1 ? 's' : ''}
                          </span>
                          <span className={`text-xs font-semibold w-12 text-right flex-shrink-0 ${star >= 4 ? 'text-green-600' : star === 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {pct}%
                          </span>
                        </div>
                      )
                    })}
                    <p className="text-xs text-neutral-400 pt-2 border-t border-neutral-100">
                      {total} total reviews analyzed
                    </p>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── NOTES — pro only ──────────────────────────────────── */}
      {!isLimited && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Analysis notes</h3>
            {isPro && <span className="text-xs text-orange-600 font-medium">Pro</span>}
          </div>
          {isPro ? (
            notesPersisted && notes && !notesEditing ? (
              <div className="flex items-start justify-between gap-3 p-3 bg-neutral-50 rounded-xl">
                <p className="text-sm text-neutral-700 leading-relaxed flex-1">{notes}</p>
                <button onClick={() => setNotesEditing(true)} className="flex-shrink-0 p-1.5 text-neutral-400 hover:text-black transition-colors rounded-lg hover:bg-neutral-200">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <textarea
                  value={notes}
                  onChange={e => { setNotes(e.target.value); setNotesSaved(false); if (!e.target.value) setNotesPersisted(false) }}
                  placeholder="Add private notes — what to fix first, ideas, action items..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-xl outline-none focus:border-orange-400 transition-colors resize-none placeholder:text-neutral-400"
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-neutral-400">Only visible to you</p>
                  <button
                    onClick={async () => { await saveNotes(); setNotesEditing(false) }}
                    disabled={notesSaving}
                    className="px-4 py-1.5 text-xs font-medium bg-black text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  >
                    {notesSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </>
            )
          ) : (
            <div className="p-4 bg-neutral-50 rounded-xl text-center">
              <p className="text-xs text-neutral-500 mb-2">Add private notes to track what to fix and action items</p>
              <a href="/#pricing" className="text-xs text-orange-600 font-medium hover:underline">Upgrade to Pro →</a>
            </div>
          )}
        </div>
      )}

      {isLimited && <UpgradeBanner />}

      <div className="bg-white rounded-2xl border border-neutral-200 p-5 text-center">
        <p className="text-sm font-medium mb-1">Analyze another product</p>
        {isLimited && (
          <p className="text-xs text-neutral-400 mb-3">
            You have {analysesRemaining} free {analysesRemaining === 1 ? 'analysis' : 'analyses'} remaining
          </p>
        )}
        <button onClick={() => router.push('/dashboard')} className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors">
          New analysis →
        </button>
      </div>

    </div>

    {/* ── STAR RATING NOTIFICATION ── */}
    {showRating && (
      <div className="fixed bottom-6 right-6 z-50 w-80 bg-white border border-neutral-200 rounded-2xl shadow-2xl p-5"
        style={{ animation: 'slideUp 0.35s ease forwards' }}>
        <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <button
          onClick={() => {
            setShowRating(false)
            setRatingValue(0)
            setRatingDone(false)
            setRatingFeedback('')
            setRatingSubmitting(false)
            setFeedbackSent(false)
            const count = parseInt(localStorage.getItem('voxrate_dismiss_count') || '0') + 1
            const total = parseInt(localStorage.getItem('voxrate_analysis_count') || '0')
            localStorage.setItem('voxrate_dismiss_count', String(count))
            localStorage.setItem('voxrate_dismiss_at_analysis', String(total))
          }}
          className="absolute top-3 right-3 text-neutral-300 hover:text-neutral-500 transition-colors"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        {feedbackSent ? (
          <p className="text-sm text-center text-green-600 font-medium py-2">Thank you! Your feedback helps us improve. 🙏</p>
        ) : !ratingDone ? (
          <>
            <p className="text-sm font-semibold text-neutral-900 mb-0.5">How was your analysis?</p>
            <p className="text-xs text-neutral-400 mb-4">Rate your Voxrate experience out of 5</p>
            <div className="flex items-center gap-1 justify-center">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => { setRatingValue(star); setRatingDone(true) }}
                  onMouseEnter={() => setRatingHover(star)}
                  onMouseLeave={() => setRatingHover(0)}
                  className="text-4xl transition-transform hover:scale-125 leading-none"
                  style={{ color: star <= (ratingHover || ratingValue) ? '#f05a1e' : '#e5e7eb' }}
                >
                  ★
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-neutral-900 mb-0.5">
              {ratingValue <= 2 ? 'Sorry to hear that 😔' : ratingValue === 3 ? 'Thanks for rating!' : 'Glad you liked it! 🎉'}
            </p>
            <p className="text-xs text-neutral-400 mb-3">
              {ratingValue <= 2 ? 'What went wrong? Help us fix it.' : 'Anything we can improve? (optional)'}
            </p>
            <div className="flex gap-1 justify-center mb-3">
              {[1, 2, 3, 4, 5].map(star => (
                <span key={star} className="text-2xl leading-none" style={{ color: star <= ratingValue ? '#f05a1e' : '#e5e7eb' }}>★</span>
              ))}
            </div>
            <textarea
              value={ratingFeedback}
              onChange={e => setRatingFeedback(e.target.value)}
              placeholder={ratingValue <= 2 ? 'Tell us what went wrong...' : 'Your thoughts (optional)...'}
              rows={3}
              className="w-full text-xs border border-neutral-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-orange-400 text-neutral-700 placeholder-neutral-300"
            />
            <button
              disabled={ratingSubmitting}
              onClick={async () => {
                setRatingSubmitting(true)
                let saved = false
                try {
                  const { data: { user } } = await supabase.auth.getUser()
                  if (user) {
                    const { error } = await supabase.from('ratings').insert({
                      user_id: user.id,
                      rating: ratingValue,
                      feedback: ratingFeedback.trim() || null,
                      source: 'report_page',
                    })
                    if (!error) saved = true
                  }
                } catch {}
                setRatingSubmitting(false)
                if (saved) {
                  setFeedbackSent(true)
                  setTimeout(() => setShowRating(false), 2500)
                } else {
                  // Silently close — don't show false success to unauthenticated users
                  setShowRating(false)
                }
              }}
              className="mt-2 w-full py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {ratingSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </>
        )}
      </div>
    )}
    </>
  )
}
