export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkCsrf } from '@/app/lib/csrf'
import { requireAdmin } from '@/app/lib/admin-check'
import { adminSupa } from '@/app/lib/ambassador-auth'

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const id = String(body?.id || '')
    const action = String(body?.action || '')
    if (!id || !action) return NextResponse.json({ error: 'Missing id or action' }, { status: 400 })

    const supa = adminSupa()
    const { data: amb } = await supa.from('ambassadors').select('*').eq('id', id).single()
    if (!amb) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'pause') {
      await supa.from('ambassadors').update({ status: 'paused' }).eq('id', id)
    } else if (action === 'unpause') {
      await supa.from('ambassadors').update({ status: 'active' }).eq('id', id)
    } else if (action === 'delete') {
      await supa.from('ambassador_conversions').delete().eq('ambassador_id', id)
      await supa.from('ambassador_clicks').delete().eq('ambassador_id', id)
      await supa.from('ambassador_attribution').delete().eq('ambassador_id', id)
      await supa.from('ambassador_payouts').delete().eq('ambassador_id', id)
      await supa.from('ambassadors').update({ friend_invited_id: null }).eq('friend_invited_id', id)
      await supa.from('ambassadors').update({ invited_by_ambassador_id: null }).eq('invited_by_ambassador_id', id)
      await supa.from('ambassadors').delete().eq('id', id)
    } else if (action === 'toggle-pro') {
      await supa.from('ambassadors').update({ pro_access: !amb.pro_access }).eq('id', id)
    } else if (action === 'update-notes') {
      await supa.from('ambassadors').update({ notes: String(body?.notes || '') }).eq('id', id)
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[admin ambassador update] error', err?.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
