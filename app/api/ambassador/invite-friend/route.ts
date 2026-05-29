export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkCsrf } from '@/app/lib/csrf'
import { checkRateLimit } from '@/app/lib/rate-limit'
import { getAmbassadorFromToken, adminSupa } from '@/app/lib/ambassador-auth'

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const amb = await getAmbassadorFromToken(request)
  if (!amb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await checkRateLimit(amb.id, 'user', 10)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  if (amb.friend_invited_id) {
    return NextResponse.json({ error: 'You have already invited your one friend' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const friendCode = String(body?.friendCode || '').trim().toUpperCase()
    if (!friendCode) return NextResponse.json({ error: 'Missing friend code' }, { status: 400 })

    const supa = adminSupa()

    const { data: codeRow } = await supa
      .from('ambassador_codes')
      .select('id, used, used_by_ambassador_id')
      .eq('code', friendCode)
      .single()

    if (!codeRow || !codeRow.used || !codeRow.used_by_ambassador_id) {
      return NextResponse.json({ error: 'Friend code not used yet — ask them to apply first' }, { status: 400 })
    }

    if (codeRow.used_by_ambassador_id === amb.id) {
      return NextResponse.json({ error: 'That is your own code' }, { status: 400 })
    }

    const { data: friend } = await supa
      .from('ambassadors')
      .select('id, invited_by_ambassador_id')
      .eq('id', codeRow.used_by_ambassador_id)
      .single()

    if (!friend) return NextResponse.json({ error: 'Friend not found' }, { status: 400 })
    if (friend.invited_by_ambassador_id && friend.invited_by_ambassador_id !== amb.id) {
      return NextResponse.json({ error: 'That friend was already invited by someone else' }, { status: 400 })
    }

    const { error: updErr } = await supa
      .from('ambassadors')
      .update({ friend_invited_id: friend.id })
      .eq('id', amb.id)
      .is('friend_invited_id', null)

    if (updErr) {
      console.error('[invite-friend] self update failed', updErr.message)
      return NextResponse.json({ error: 'Failed to record invite' }, { status: 500 })
    }

    await supa
      .from('ambassadors')
      .update({ invited_by_ambassador_id: amb.id })
      .eq('id', friend.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[invite-friend] error', err?.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
