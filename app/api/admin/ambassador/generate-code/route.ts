export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkCsrf } from '@/app/lib/csrf'
import { requireAdmin } from '@/app/lib/admin-check'
import { adminSupa } from '@/app/lib/ambassador-auth'
import { generateAmbassadorCode, generateProCode } from '@/app/lib/ambassador-codes'

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const type = body?.type === 'pro_access' ? 'pro_access' : 'ambassador'
    const assignedName = body?.assignedName ? String(body.assignedName).trim() : null
    const assignedEmail = body?.assignedEmail ? String(body.assignedEmail).trim().toLowerCase() : null
    const count = Math.min(Math.max(parseInt(body?.count, 10) || 1, 1), 50)

    if (type === 'pro_access' && !assignedEmail) {
      return NextResponse.json({ error: 'PRO codes require assigned_email' }, { status: 400 })
    }

    const supa = adminSupa()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const created: string[] = []

    for (let i = 0; i < count; i++) {
      let codeStr = ''
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = type === 'pro_access' ? generateProCode() : generateAmbassadorCode()
        const { data: clash } = await supa.from('ambassador_codes').select('id').eq('code', candidate).maybeSingle()
        if (!clash) { codeStr = candidate; break }
      }
      if (!codeStr) continue
      const { error } = await supa.from('ambassador_codes').insert({
        code: codeStr,
        type,
        assigned_name: assignedName,
        assigned_email: type === 'pro_access' ? assignedEmail : null,
        expires_at: expiresAt,
      })
      if (!error) created.push(codeStr)
    }

    return NextResponse.json({ success: true, codes: created, expiresAt })
  } catch (err: any) {
    console.error('[admin generate-code] error', err?.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
