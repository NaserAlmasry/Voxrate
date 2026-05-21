'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/app/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [done, setDone]                 = useState(false)
  const supabase                        = createClient()
  const router                          = useRouter()

  const handleSubmit = async () => {
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');`}</style>
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl w-full max-w-sm p-8">
        <Link href="/" className="flex justify-center mb-6">
          <img src="/logo.png" alt="Voxrate" height={24} style={{ objectFit: 'contain', maxWidth: 110 }} />
        </Link>

        {done ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-sm font-semibold text-neutral-800 mb-1">Password updated</p>
            <p className="text-xs text-neutral-400">Redirecting you to your dashboard…</p>
          </div>
        ) : (
          <>
            <h1 className="text-base font-semibold text-neutral-900 mb-1">Set a new password</h1>
            <p className="text-xs text-neutral-400 mb-6">Choose a strong password — at least 8 characters.</p>

            <div className="space-y-3">
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={handleSubmit}
                disabled={loading || !password || !confirm}
                className="w-full py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-40"
              >
                {loading ? 'Saving…' : 'Update password →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
