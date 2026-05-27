// Daily digest — runs every day at 08:00 UTC
// Sends digest only to Pro users who opted into daily frequency

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const maxDuration = 120

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function h(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function scoreColor(n: number): string {
  return n >= 66 ? '#22c55e' : n >= 38 ? '#f97316' : '#ef4444'
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authHeader = request.headers.get('authorization') || ''
  const expected   = Buffer.from(`Bearer ${cronSecret}`)
  const actual     = Buffer.from(authHeader)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resend   = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  const supabase = adminClient()
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // Pro users only with daily digest preference
  const { data: userRows } = await supabase
    .from('users')
    .select('id')
    .eq('plan', 'pro')
    .eq('weekly_digest_enabled', true)
    .eq('digest_frequency', 'daily')
    .limit(500)

  if (!userRows || userRows.length === 0) return NextResponse.json({ sent: 0 })

  let sent = 0
  const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString()

  for (const userRow of userRows) {
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(userRow.id)
      if (!authUser?.user?.email) continue
      const email     = authUser.user.email
      const firstName = authUser.user.user_metadata?.full_name?.split(' ')[0] ?? email.split('@')[0]

      const { data: todayReports } = await supabase
        .from('reports')
        .select('id, product_name, health_score, asin, created_at, full_report')
        .eq('user_id', userRow.id)
        .eq('status', 'completed')
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!todayReports || todayReports.length === 0) continue

      const avgScore = Math.round(todayReports.reduce((s, r) => s + (r.health_score || 0), 0) / todayReports.length)

      const reportRows = todayReports.slice(0, 5).map(r => `
        <tr>
          <td style="padding:8px 12px;font-size:12px;color:#374151;">${h(r.product_name || r.asin || '—')}</td>
          <td style="padding:8px 12px;text-align:center;">
            <span style="font-weight:700;color:${scoreColor(r.health_score || 0)};">${r.health_score ?? '—'}</span>
          </td>
          <td style="padding:8px 12px;text-align:right;">
            <a href="${SITE_URL}/dashboard/report/${r.id}" style="font-size:11px;color:#f97316;text-decoration:none;">View →</a>
          </td>
        </tr>`).join('')

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#f97316;padding:20px 24px;">
      <span style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Voxrate</span>
      <span style="display:block;font-size:11px;color:#fed7aa;margin-top:2px;">Daily summary — ${dateLabel}</span>
    </div>
    <div style="padding:24px;">
      <p style="font-size:15px;font-weight:600;color:#111;margin:0 0 16px;">Good morning ${h(firstName)},</p>
      <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">Here's what happened in your shop in the last 24 hours.</p>

      <div style="padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:20px;text-align:center;">
        <p style="font-size:11px;color:#9ca3af;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em;">Avg health score today</p>
        <p style="font-size:36px;font-weight:900;color:${scoreColor(avgScore)};margin:0;line-height:1;">${avgScore}</p>
        <p style="font-size:11px;color:#9ca3af;margin:4px 0 0;">across ${todayReports.length} report${todayReports.length !== 1 ? 's' : ''}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Product</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Score</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;">Report</th>
          </tr>
        </thead>
        <tbody>${reportRows}</tbody>
      </table>

      <a href="${SITE_URL}/dashboard"
         style="display:block;text-align:center;padding:14px;background:#f97316;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">
        Open Dashboard →
      </a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        Daily digest from <a href="${SITE_URL}" style="color:#f97316;text-decoration:none;">Voxrate</a> &mdash;
        <a href="${SITE_URL}/dashboard/settings" style="color:#9ca3af;">Change to weekly</a>
      </p>
    </div>
  </div>
</body>
</html>`

      if (resend) {
        await resend.emails.send({
          from:    'Voxrate <noreply@voxrate.app>',
          to:      email,
          subject: `Your Voxrate daily summary — ${dateLabel}`,
          html,
        })
        sent++
      }
    } catch (err: any) {
      console.error(`[DailyDigest] Failed for user ${userRow.id}:`, err?.message)
    }
  }

  return NextResponse.json({ sent, total: userRows.length })
}
