import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { verifyCronBearer } from '@/app/lib/cron-auth'
import { Resend } from 'resend'
import { callMistral2411 } from '@/app/lib/mistral-fallback'

export const maxDuration = 300

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

function scoreLabel(n: number): string {
  return n >= 66 ? 'Healthy' : n >= 38 ? 'Needs work' : 'Critical'
}

export async function GET(request: NextRequest) {
  const authError = verifyCronBearer(request)
  if (authError) return authError

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  const supabase = adminClient()
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'

  const sevenDaysAgo  = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const fourteenAgo   = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const dateLabel     = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const { data: userRows } = await supabase
    .from('users')
    .select('id')
    .eq('weekly_digest_enabled', true)
    .limit(500)

  if (!userRows || userRows.length === 0) return NextResponse.json({ sent: 0 })

  let sent = 0
  const BATCH = 10

  async function processUser(userRow: { id: string }): Promise<boolean> {
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(userRow.id)
      if (!authUser?.user?.email) return false
      const email     = authUser.user.email
      const firstName = authUser.user.user_metadata?.full_name?.split(' ')[0] ?? email.split('@')[0]

      const [
        { data: thisWeekReports },
        { data: lastWeekReports },
        { data: activeAlerts },
      ] = await Promise.all([
        supabase
          .from('reports')
          .select('id, product_name, health_score, asin, created_at, top_complaint, full_report')
          .eq('user_id', userRow.id)
          .eq('status', 'completed')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('reports')
          .select('health_score')
          .eq('user_id', userRow.id)
          .eq('status', 'completed')
          .gte('created_at', fourteenAgo)
          .lt('created_at', sevenDaysAgo)
          .limit(5),
        supabase
          .from('sentiment_alerts')
          .select('id, asin, product_name, frequency')
          .eq('user_id', userRow.id)
          .eq('active', true)
          .limit(10),
      ])

      const unreadAlerts = activeAlerts

      const thisWeekAvg = thisWeekReports && thisWeekReports.length > 0
        ? Math.round(thisWeekReports.reduce((s, r) => s + (r.health_score || 0), 0) / thisWeekReports.length)
        : null

      const lastWeekAvg = lastWeekReports && lastWeekReports.length > 0
        ? Math.round(lastWeekReports.reduce((s, r) => s + (r.health_score || 0), 0) / lastWeekReports.length)
        : null

      // Top complaint: most common across recent reports
      const complaintMap = new Map<string, number>()
      for (const r of (thisWeekReports || [])) {
        const complaints: { title?: string }[] = r.full_report?.complaints || []
        for (const c of complaints.slice(0, 3)) {
          if (c.title) complaintMap.set(c.title, (complaintMap.get(c.title) || 0) + 1)
        }
      }
      let topComplaint: string | null = null
      if (complaintMap.size > 0) {
        topComplaint = [...complaintMap.entries()].sort((a, b) => b[1] - a[1])[0][0]
      } else if (thisWeekReports && thisWeekReports.length > 0) {
        topComplaint = thisWeekReports[0].top_complaint || null
      }

      // Mistral priority action
      let priorityAction = ''
      if (thisWeekAvg !== null || topComplaint) {
        try {
          const context = [
            thisWeekAvg !== null ? `Shop health score: ${thisWeekAvg}/100` : '',
            lastWeekAvg !== null ? `Last week average: ${lastWeekAvg}/100` : '',
            topComplaint ? `Top complaint: ${topComplaint}` : '',
            unreadAlerts && unreadAlerts.length > 0 ? `Active sentiment monitors: ${unreadAlerts.length}` : '',
          ].filter(Boolean).join('\n')

          const raw = await callMistral2411([
            { role: 'system', content: 'You are an Amazon seller advisor. Respond with exactly 2 sentences of specific, actionable advice. No bullet points, no preamble.' },
            { role: 'user', content: `Based on this Amazon seller data, give one priority action:\n${context}` },
          ], 120)
          priorityAction = raw.trim()
        } catch {
          priorityAction = 'Review your top complaint and update your listing description to address it directly.'
        }
      }

      // Build email HTML
      const trendHtml = thisWeekAvg !== null && lastWeekAvg !== null && thisWeekAvg !== lastWeekAvg
        ? `<span style="margin-left:8px;font-size:12px;font-weight:600;color:${thisWeekAvg > lastWeekAvg ? '#22c55e' : '#ef4444'};">${thisWeekAvg > lastWeekAvg ? `â–² +${thisWeekAvg - lastWeekAvg}` : `â–¼ ${thisWeekAvg - lastWeekAvg}`} vs last week</span>`
        : ''

      const scoreSection = thisWeekAvg !== null ? `
      <div style="margin-bottom:20px;">
        <p style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 10px;">Shop Health</p>
        <div style="display:flex;align-items:center;gap:4px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
          <span style="font-size:36px;font-weight:900;color:${scoreColor(thisWeekAvg)};line-height:1;">${thisWeekAvg}</span>
          <span style="font-size:14px;color:#9ca3af;margin-top:6px;">/100</span>
          <span style="margin-left:6px;font-size:12px;font-weight:600;color:${scoreColor(thisWeekAvg)};">${scoreLabel(thisWeekAvg)}</span>
          ${trendHtml}
        </div>
      </div>` : ''

      const alertsSection = unreadAlerts && unreadAlerts.length > 0 ? (() => {
        const listHtml = unreadAlerts.slice(0, 3).map(a =>
          `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;margin-bottom:6px;">
            <span style="font-size:12px;color:#374151;">${h((a as { product_name?: string; asin?: string }).product_name || (a as { asin?: string }).asin || '')}</span>
            <span style="font-size:10px;color:#9ca3af;margin-left:auto;">${h((a as { frequency?: string }).frequency || '')}</span>
          </div>`
        ).join('')
        return `
        <div style="margin-bottom:20px;">
          <p style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 10px;">Active Monitors <span style="background:#f97316;color:#fff;border-radius:999px;padding:1px 7px;font-size:10px;">${unreadAlerts.length}</span></p>
          ${listHtml}
          ${unreadAlerts.length > 3 ? `<p style="font-size:11px;color:#9ca3af;margin:4px 0 0;">+${unreadAlerts.length - 3} more</p>` : ''}
        </div>`
      })() : ''

      const complaintSection = topComplaint ? `
      <div style="margin-bottom:20px;">
        <p style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 10px;">Top Complaint This Week</p>
        <div style="padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;">
          <p style="font-size:13px;color:#9a3412;margin:0;">&#x26A0; ${h(topComplaint)}</p>
        </div>
      </div>` : ''

      const actionSection = priorityAction ? `
      <div style="margin-bottom:20px;">
        <p style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 10px;">AI Priority Action</p>
        <div style="padding:14px 16px;background:#fff7ed;border-left:3px solid #f97316;border-radius:0 10px 10px 0;">
          <p style="font-size:13px;color:#374151;margin:0;line-height:1.6;">${h(priorityAction)}</p>
        </div>
      </div>` : ''

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#f97316;padding:20px 24px;">
      <span style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Voxrate</span>
      <span style="display:block;font-size:11px;color:#fed7aa;margin-top:2px;">Weekly summary</span>
    </div>
    <div style="padding:24px;">
      <p style="font-size:15px;font-weight:600;color:#111;margin:0 0 20px;">Good morning ${h(firstName)},</p>
      ${scoreSection}
      ${alertsSection}
      ${complaintSection}
      ${actionSection}
      <a href="${SITE_URL}/dashboard"
         style="display:block;text-align:center;padding:14px;background:#f97316;color:#fff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;margin-top:8px;">
        Open Dashboard &#x2192;
      </a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        Weekly digest from <a href="${SITE_URL}" style="color:#f97316;text-decoration:none;">Voxrate</a> &mdash;
        <a href="${SITE_URL}/dashboard/settings" style="color:#9ca3af;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`

      if (resend) {
        await resend.emails.send({
          from:    'Voxrate <noreply@voxrate.app>',
          to:      email,
          subject: `Your Voxrate weekly summary — ${dateLabel}`,
          html,
        })
        return true
      }
      return false
    } catch (err: any) {
      console.error(`[WeeklyDigest] Failed for user ${userRow.id}:`, err?.message)
      return false
    }
  }

  for (let i = 0; i < userRows.length; i += BATCH) {
    const batch = userRows.slice(i, i + BATCH)
    const results = await Promise.allSettled(batch.map(processUser))
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value === true) sent++
    }
  }

  return NextResponse.json({ sent, total: userRows.length })
}
