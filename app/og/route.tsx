import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '48px' }}>
          <div style={{
            width: '48px', height: '48px', background: '#f97316',
            borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: '24px', height: '24px', background: 'white', borderRadius: '50%', display: 'flex' }} />
          </div>
          <span style={{ color: 'white', fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px' }}>Voxrate</span>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '24px', maxWidth: '900px' }}>
          <span style={{ color: 'white', fontSize: '64px', fontWeight: '800', lineHeight: '1.1', letterSpacing: '-2px' }}>
            AI Review Analyzer
          </span>
          <span style={{ color: '#f97316', fontSize: '64px', fontWeight: '800', lineHeight: '1.1', letterSpacing: '-2px' }}>
            for Amazon Sellers
          </span>
        </div>

        {/* Subheadline */}
        <div style={{ color: '#737373', fontSize: '24px', fontWeight: '400', marginBottom: '56px', maxWidth: '700px', lineHeight: '1.5', display: 'flex' }}>
          Find why your listings aren't selling. Fix it in minutes.
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {['Health score', 'Top complaints', 'AI fixes', 'Competitor intel'].map(label => (
            <div key={label} style={{
              background: '#1a1a1a', border: '1px solid #333',
              borderRadius: '100px', padding: '10px 20px',
              color: '#d4d4d4', fontSize: '16px', fontWeight: '500',
              display: 'flex',
            }}>
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
