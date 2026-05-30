import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export function adminSupa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function getAmbassadorFromToken(request: NextRequest) {
  const rawToken = request.cookies.get('ambassador_token')?.value
  if (!rawToken) return null
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const supa = adminSupa()
  const { data } = await supa
    .from('ambassadors')
    .select('*')
    .eq('session_token', tokenHash)
    .single()
  if (!data) return null
  if (data.session_expires_at && new Date(data.session_expires_at) < new Date()) return null
  if (data.status !== 'active') return null
  if (data.internship_end && new Date(data.internship_end) < new Date()) {
    await supa.from('ambassadors').update({ status: 'expired' }).eq('id', data.id)
    return null
  }
  return data
}
