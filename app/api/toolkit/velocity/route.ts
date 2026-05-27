import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getUserFromToken(token: string) {
  const supabase = adminClient()
  const { data } = await supabase
    .from('extension_sessions')
    .select('user_id')
    .eq('token', token)
    .single()
  return data
}

interface VelocityPayload {
  asin: string
  one_star: number
  two_star?: number
  three_star?: number
  four_star?: number
  five_star?: number
  total?: number
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getUserFromToken(token)
  if (!session) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  let body: VelocityPayload
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { asin, one_star, two_star = 0, three_star = 0, four_star = 0, five_star = 0 } = body
  if (!asin) return NextResponse.json({ error: 'Missing asin' }, { status: 400 })
  if (typeof one_star !== 'number' || isNaN(one_star)) return NextResponse.json({ error: 'Invalid one_star' }, { status: 400 })

  const supabase = adminClient()
  const userId = session.user_id
  const today = new Date().toISOString().split('T')[0]

  // Only process watched ASINs
  const { data: monitored } = await supabase
    .from('monitored_asins')
    .select('id')
    .eq('user_id', userId)
    .eq('asin', asin)
    .maybeSingle()
  if (!monitored) return NextResponse.json({ ok: true })
  const total = one_star + two_star + three_star + four_star + five_star

  await supabase.from('review_velocity').upsert({
    user_id: userId,
    asin,
    date: today,
    one_star,
    two_star,
    three_star,
    four_star,
    five_star,
    total,
  }, { onConflict: 'user_id,asin,date' })

  // Check attack pattern: get last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: history } = await supabase
    .from('review_velocity')
    .select('date, one_star')
    .eq('user_id', userId)
    .eq('asin', asin)
    .gte('date', sevenDaysAgo)
    .order('date', { ascending: false })

  if (history && history.length >= 2) {
    const recentDays = history.slice(1) // exclude today
    const avgOneStar = recentDays.reduce((sum, d) => sum + (d.one_star || 0), 0) / recentDays.length

    const spikeAbsolute = one_star >= 5
    const spikeRelative = avgOneStar > 0 && one_star >= avgOneStar * 3

    if (spikeAbsolute || spikeRelative) {
      // Check we haven't already alerted today
      const { data: existingAlert } = await supabase
        .from('alerts')
        .select('id')
        .eq('user_id', userId)
        .eq('asin', asin)
        .eq('type', 'review_attack')
        .gte('created_at', `${today}T00:00:00Z`)
        .limit(1)
        .maybeSingle()

      if (!existingAlert) {
        const reason = spikeAbsolute
          ? `${one_star} one-star reviews detected today (threshold: 5)`
          : `${one_star} one-star reviews today vs. ${avgOneStar.toFixed(1)} daily average (3x spike)`

        await supabase.from('alerts').insert({
          user_id: userId,
          type: 'review_attack',
          severity: 'critical',
          title: `Possible review attack on ${asin}`,
          body: reason,
          asin,
          data: { today_one_star: one_star, avg_one_star: avgOneStar, history },
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
