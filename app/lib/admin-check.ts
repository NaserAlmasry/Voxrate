import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

export async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: me } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { ok: true, userId: user.id }
}
