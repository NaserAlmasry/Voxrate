// ============================================================
// NOT FOUND — voxrate/app/not-found.tsx
// ============================================================

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center px-6 text-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');`}</style>
      <a href="/">
        <img src="/logo.png" alt="Voxrate" height={32} style={{ objectFit: 'contain', maxWidth: 130, marginBottom: 40 }} />
      </a>
      <p className="text-6xl font-bold text-neutral-200 mb-4">404</p>
      <h1 className="text-xl font-semibold mb-2">Page not found</h1>
      <p className="text-sm text-neutral-500 mb-8">The page you're looking for doesn't exist or has been moved.</p>
      <a href="/" className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors">
        Back to home →
      </a>
    </div>
  )
}
