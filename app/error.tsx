'use client'

// ============================================================
// ERROR PAGE — voxrate/app/error.tsx
// ============================================================

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[Voxrate Error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center px-6 text-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');`}</style>
      <a href="/">
        <img src="/logo.png" alt="Voxrate" height={32} style={{ objectFit: 'contain', maxWidth: 130, marginBottom: 40 }} />
      </a>
      <p className="text-4xl mb-4">⚠️</p>
      <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
      <p className="text-sm text-neutral-500 mb-8 max-w-sm">An unexpected error occurred. This has been logged and we'll look into it.</p>
      <div className="flex gap-3">
        <button onClick={reset}
          className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors">
          Try again
        </button>
        <a href="/"
          className="px-5 py-2.5 border border-neutral-200 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors">
          Back to home
        </a>
      </div>
    </div>
  )
}
