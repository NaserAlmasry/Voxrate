export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/admin-check'
import { adminSupa } from '@/app/lib/ambassador-auth'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supa = adminSupa()
  const { data: codes } = await supa
    .from('ambassador_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const now = new Date()
  const enriched = (codes || []).map(c => ({
    id: c.id,
    code: c.code,
    type: c.type,
    assigned_name: c.assigned_name,
    assigned_email: c.assigned_email,
    used: c.used,
    expires_at: c.expires_at,
    status: c.used ? 'used' : (new Date(c.expires_at) < now ? 'expired' : 'unused'),
    created_at: c.created_at,
  }))

  return NextResponse.json({ codes: enriched })
}
