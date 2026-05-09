'use client'

// ============================================================
// LoginButton — voxrate/app/components/LoginButton.tsx
// ============================================================

import { createClient } from '@/app/lib/supabase/client'

export default function LoginButton({ label = 'Sign in' }: { label?: string }) {
  const supabase = createClient()

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Forces Google to ALWAYS show the account picker
        // even if the user is already signed into one Google account
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  }

  return (
    <button
      onClick={signInWithGoogle}
      className="glow px-5 py-2.5 text-sm font-medium rounded-full bg-black text-white hover:bg-neutral-800 transition-colors"
    >
      {label}
    </button>
  )
}
