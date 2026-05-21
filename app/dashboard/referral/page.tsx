'use client'

// ============================================================
// REFERRAL PROGRAM — voxrate/app/dashboard/referral/page.tsx
// ============================================================

import { useEffect, useState } from 'react'
import { Gift, Copy, Check, AlertTriangle } from 'lucide-react'

type ReferralInfo = {
  referral_code: string | null
  referral_count: number
  referral_link: string | null
}

const STARTER_THRESHOLD = 3
const GROWTH_THRESHOLD  = 5
const PRO_THRESHOLD     = 15

export default function ReferralPage() {
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState<{ reward_plan: string; message: string } | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/referral', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not load referral info'); return }
      setInfo(data)
    } catch {
      setError('Could not load referral info')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const copyLink = async () => {
    if (!info?.referral_link) return
    try {
      await navigator.clipboard.writeText(info.referral_link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard')
    }
  }

  const claim = async () => {
    setClaiming(true)
    setError('')
    try {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ action: 'claim' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not claim reward'); setShowConfirm(false); return }
      setClaimResult({ reward_plan: data.reward_plan, message: data.message })
      setShowConfirm(false)
      await load()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  const count = info?.referral_count ?? 0
  const nextThreshold = count >= PRO_THRESHOLD ? PRO_THRESHOLD : count >= GROWTH_THRESHOLD ? PRO_THRESHOLD : count >= STARTER_THRESHOLD ? GROWTH_THRESHOLD : STARTER_THRESHOLD
  const progressPct = Math.min(100, Math.round((count / nextThreshold) * 100))
  const canClaim = count >= STARTER_THRESHOLD
  const tierLabel = count >= PRO_THRESHOLD
    ? 'Pro plan — 1 month free'
    : count >= GROWTH_THRESHOLD
      ? `Growth plan — 1 month free (or refer ${PRO_THRESHOLD - count} more for Pro)`
      : count >= STARTER_THRESHOLD
        ? `Starter plan — 1 month free (or refer ${GROWTH_THRESHOLD - count} more for Growth)`
        : `Refer ${STARTER_THRESHOLD - count} more paid user${STARTER_THRESHOLD - count === 1 ? '' : 's'} to unlock Starter`

  return (
    <div className="max-w-2xl mx-auto space-y-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
          <Gift size={20} className="text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Referral program</h1>
          <p className="text-xs text-neutral-400">Earn free months by inviting other Amazon sellers.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
          <AlertTriangle size={13} />
          {error}
        </div>
      )}

      {claimResult && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl space-y-1">
          <p className="text-sm font-semibold text-green-700">Reward applied!</p>
          <p className="text-xs text-green-700">{claimResult.message}</p>
          <p className="text-xs text-green-600">Your count has been reset to 0. Keep referring to earn more rewards.</p>
        </div>
      )}

      {/* How it works */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">How it works</h2>
        <ul className="space-y-2 text-xs text-neutral-600">
          <li className="flex gap-2"><span className="text-orange-500 font-bold">1.</span> Share your unique referral link below.</li>
          <li className="flex gap-2"><span className="text-orange-500 font-bold">2.</span> When someone signs up and upgrades to a paid plan, your counter goes up by 1.</li>
          <li className="flex gap-2"><span className="text-orange-500 font-bold">3.</span> Reach {STARTER_THRESHOLD} → 1 free month of Starter. Reach {GROWTH_THRESHOLD} → Growth. Reach {PRO_THRESHOLD} → Pro.</li>
          <li className="flex gap-2"><span className="text-orange-500 font-bold">4.</span> Claiming resets your count to 0. You keep referring and earn again.</li>
        </ul>
      </div>

      {/* Link */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">Your referral link</h2>
        {loading ? (
          <p className="text-xs text-neutral-400">Loading…</p>
        ) : info?.referral_link ? (
          <div className="flex gap-2">
            <input
              readOnly
              value={info.referral_link}
              className="flex-1 px-4 py-3 text-sm border border-neutral-200 rounded-xl bg-neutral-50 outline-none"
              onFocus={e => e.currentTarget.select()}
            />
            <button
              onClick={copyLink}
              className="px-4 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors flex items-center gap-2"
            >
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
        ) : (
          <p className="text-xs text-neutral-400">No referral link yet. Reload the page.</p>
        )}
      </div>

      {/* Progress + claim */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700">Your progress</h2>
          <span className="text-xs font-medium text-neutral-500">{count} paid referral{count === 1 ? '' : 's'}</span>
        </div>

        <div className="space-y-2">
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>0</span>
            <span>{STARTER_THRESHOLD} → Starter</span>
            <span>{GROWTH_THRESHOLD} → Growth</span>
            <span>{PRO_THRESHOLD} → Pro</span>
          </div>
        </div>

        <p className="text-xs text-neutral-500">{tierLabel}</p>

        <button
          onClick={() => setShowConfirm(true)}
          disabled={!canClaim || claiming}
          className="w-full py-3 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {canClaim
            ? `Claim ${count >= PRO_THRESHOLD ? 'Pro' : count >= GROWTH_THRESHOLD ? 'Growth' : 'Starter'} — 1 month free`
            : `Need ${STARTER_THRESHOLD - count} more paid referral${STARTER_THRESHOLD - count === 1 ? '' : 's'}`}
        </button>
      </div>

      {/* Contact note */}
      <p className="text-xs text-neutral-400 text-center pb-2">
        Think there's a mistake with your referral count?{' '}
        <a href="mailto:info@voxrate.app" className="text-orange-500 hover:underline">Contact us</a> and we'll look into it.
      </p>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Confirm reward claim</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Claiming resets your referral count to 0. You currently have <strong>{count}</strong> paid referral{count === 1 ? '' : 's'}. Continue?
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={claiming}
                className="flex-1 py-2.5 text-sm border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={claim}
                disabled={claiming}
                className="flex-1 py-2.5 text-sm font-semibold bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {claiming ? 'Claiming…' : 'Yes, claim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
