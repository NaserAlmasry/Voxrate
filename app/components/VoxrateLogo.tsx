// ============================================================
// VoxrateLogo — app/components/VoxrateLogo.tsx
// SVG logo matching the Voxrate brand: black V + orange arrow + wordmark
// Usage: <VoxrateLogo size="md" /> or <VoxrateLogo size="sm" showText={false} />
// ============================================================

interface VoxrateLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export default function VoxrateLogo({ size = 'md', showText = true, className = '' }: VoxrateLogoProps) {
  const heights = { sm: 24, md: 32, lg: 44 }
  const h = heights[size]

  return (
    <div className={`flex items-center gap-0 ${className}`} style={{ height: h }}>
      {/* V + Arrow SVG icon */}
      <svg
        height={h}
        viewBox="0 0 60 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* Left stroke of V — black */}
        <path
          d="M2 4 L22 40"
          stroke="#1a1a1a"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Right stroke of V becoming orange arrow base */}
        <path
          d="M22 40 L32 20"
          stroke="#f05a1e"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Arrow shaft going up-right */}
        <path
          d="M32 20 L46 4"
          stroke="#f05a1e"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Arrow head */}
        <path
          d="M38 2 L50 2 L50 14"
          stroke="#f05a1e"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* Wordmark */}
      {showText && (
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 600,
            fontSize: h * 0.7,
            color: '#1a1a1a',
            letterSpacing: '-0.02em',
            marginLeft: h * 0.18,
            lineHeight: 1,
          }}
        >
          oxrate
        </span>
      )}
    </div>
  )
}
