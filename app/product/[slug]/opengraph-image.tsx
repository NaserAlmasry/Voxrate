import { ImageResponse } from 'next/og'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const alt     = 'Voxrate — Amazon Review Analysis'
export const size    = { width: 1200, height: 630 }
export const contentType = 'image/png'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = adminClient()
  const { data: page } = await admin
    .from('public_geo_pages')
    .select('product_title, health_score, total_reviews, avg_rating, buyer_phrases, complaints, show_complaints, asin')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()

  if (!page) {
    return new ImageResponse(
      <div style={{ width: 1200, height: 630, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontSize: 48, fontWeight: 700 }}>Voxrate</span>
      </div>,
      { ...size },
    )
  }

  const score      = page.health_score
  const scoreColor = score >= 75 ? '#22c55e' : score >= 50 ? '#f97316' : '#ef4444'
  const barWidth   = Math.round((score / 100) * 560)
  const phrases    = (page.buyer_phrases || []).slice(0, 3) as string[]
  const topComplaint = page.show_complaints && page.complaints?.length > 0 ? page.complaints[0] : null

  return new ImageResponse(
    <div
      style={{
        width: 1200, height: 630,
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        padding: '60px 80px',
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
      }}
    >
      {/* Voxrate brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <span style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>Voxrate</span>
        <span style={{ color: '#666', fontSize: 14, background: '#1a1a1a', padding: '4px 12px', borderRadius: 99 }}>Amazon Intelligence</span>
      </div>

      {/* Product title */}
      <div style={{ color: '#fff', fontSize: 38, fontWeight: 700, lineHeight: 1.2, marginBottom: 24, maxWidth: 800 }}>
        {page.product_title.length > 70 ? page.product_title.slice(0, 70) + '…' : page.product_title}
      </div>

      {/* Health score bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 640 }}>
          <span style={{ color: '#888', fontSize: 14, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Review Health Score</span>
          <span style={{ color: scoreColor, fontSize: 40, fontWeight: 800 }}>{score}<span style={{ fontSize: 20, color: '#555' }}>/100</span></span>
        </div>
        <div style={{ width: 640, height: 12, background: '#1f1f1f', borderRadius: 99, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: barWidth, height: 12, background: scoreColor, borderRadius: 99 }} />
        </div>
      </div>

      {/* Buyer phrases */}
      {phrases.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          {phrases.map((phrase, i) => (
            <span key={i} style={{ background: '#1a1a1a', color: '#ccc', padding: '6px 14px', borderRadius: 99, fontSize: 14, border: '1px solid #2a2a2a' }}>
              ❝ {phrase} ❞
            </span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 32, alignItems: 'center', marginTop: 'auto' }}>
        <span style={{ color: '#666', fontSize: 14 }}>{(page.total_reviews ?? 0).toLocaleString()} reviews analyzed</span>
        {page.avg_rating && <span style={{ color: '#f59e0b', fontSize: 14 }}>★ {page.avg_rating} avg</span>}
        {page.asin && <span style={{ color: '#444', fontSize: 13 }}>ASIN: {page.asin}</span>}
      </div>

      {/* Top-right badge */}
      <div style={{
        position: 'absolute', top: 60, right: 80,
        background: scoreColor + '20', border: `2px solid ${scoreColor}40`,
        borderRadius: 16, padding: '16px 24px', textAlign: 'center',
      }}>
        <div style={{ color: scoreColor, fontSize: 52, fontWeight: 800, lineHeight: 1 }}>{score}</div>
        <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>Health Score</div>
      </div>
    </div>,
    { ...size },
  )
}
