import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/app/lib/supabase/server'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  const { data: scans } = await admin
    .from('sc_scans')
    .select('scan_type, data, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ data: scans || [] })
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

interface SCScanPayload {
  scan_type: 'account_health' | 'stranded_inventory' | 'reimbursements' | 'returns' | 'heartbeat'
  data: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getUserFromToken(token)
  if (!session) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  let body: SCScanPayload
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const ALLOWED_SCAN_TYPES = ['account_health', 'stranded_inventory', 'reimbursements', 'returns', 'heartbeat'] as const
  const { scan_type, data } = body
  if (!scan_type || !ALLOWED_SCAN_TYPES.includes(scan_type as typeof ALLOWED_SCAN_TYPES[number])) {
    return NextResponse.json({ error: 'Invalid scan_type' }, { status: 400 })
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return NextResponse.json({ error: 'Missing or invalid data' }, { status: 400 })
  }

  const supabase = adminClient()
  const userId = session.user_id

  // SC Scanner is a Pro-only feature
  const { data: userData } = await supabase.from('users').select('plan, is_admin').eq('id', userId).single()
  if (!userData?.is_admin && userData?.plan !== 'pro') {
    return NextResponse.json({ error: 'SC Scanner is available on the Pro plan.', upgradeRequired: true, upgradePrompt: 'pro' }, { status: 403 })
  }

  if (scan_type !== 'heartbeat') {
    await supabase.from('sc_scans').insert({ user_id: userId, scan_type, data })
  }

  // Generate alerts based on scan type
  if (scan_type === 'account_health') {
    const health = data as {
      odr?: number
      late_shipment_rate?: number
      cancellation_rate?: number
      policy_violations?: number
    }
    const alerts: Array<{ title: string; body: string; severity: string }> = []

    if (health.odr != null && health.odr > 1) {
      alerts.push({ title: 'High Order Defect Rate', body: `ODR is ${health.odr}% (threshold: 1%)`, severity: 'critical' })
    }
    if (health.late_shipment_rate != null && health.late_shipment_rate > 4) {
      alerts.push({ title: 'High Late Shipment Rate', body: `Late shipment rate is ${health.late_shipment_rate}% (threshold: 4%)`, severity: 'warning' })
    }
    if (health.cancellation_rate != null && health.cancellation_rate > 2.5) {
      alerts.push({ title: 'High Cancellation Rate', body: `Pre-fulfillment cancel rate is ${health.cancellation_rate}% (threshold: 2.5%)`, severity: 'warning' })
    }
    if (health.policy_violations != null && health.policy_violations > 0) {
      alerts.push({ title: 'Policy Violations Detected', body: `${health.policy_violations} active policy violation(s) found`, severity: 'critical' })
    }

    const today = new Date().toISOString().split('T')[0]
    for (const alert of alerts) {
      const { data: existing } = await supabase
        .from('alerts')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'account_health')
        .eq('title', alert.title)
        .gte('created_at', `${today}T00:00:00Z`)
        .limit(1)
        .maybeSingle()
      if (!existing) {
        await supabase.from('alerts').insert({
          user_id: userId,
          type: 'account_health',
          severity: alert.severity,
          title: alert.title,
          body: alert.body,
          data,
        })
      }
    }
  }

  if (scan_type === 'stranded_inventory') {
    const inv = data as { stranded_units?: number; daily_cost?: number }
    if (inv.stranded_units != null && inv.stranded_units > 0) {
      const today = new Date().toISOString().split('T')[0]
      const { data: existing } = await supabase
        .from('alerts')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'stranded_inventory')
        .gte('created_at', `${today}T00:00:00Z`)
        .limit(1)
        .maybeSingle()

      if (!existing) {
        await supabase.from('alerts').insert({
          user_id: userId,
          type: 'stranded_inventory',
          severity: 'warning',
          title: 'Stranded Inventory Detected',
          body: `${inv.stranded_units} stranded units${inv.daily_cost ? ` costing ~$${inv.daily_cost}/day` : ''}`,
          data,
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
