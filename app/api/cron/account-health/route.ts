// Cron: /api/cron/account-health — runs every 6 hours via Vercel cron
// Pulls account health from Amazon SP-API for all Pro users who have connected.
// Zero Amazon scraping — uses official OAuth-authorized SP-API calls.
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getAccessToken, fetchAccountHealth, MARKETPLACE_IDS } from '@/app/lib/amazon/spapi'
import { verifyCronBearer } from '@/app/lib/cron-auth'

export const maxDuration = 60

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(request: NextRequest) {
  const authError = verifyCronBearer(request)
  if (authError) return authError

  const admin = adminClient()

  // Fetch all Pro users who have connected their Amazon account
  const { data: users, error } = await admin
    .from('users')
    .select('id, plan, amazon_sp_refresh_token, amazon_sp_selling_partner_id, amazon_sp_region, amazon_sp_api_url')
    .eq('plan', 'pro')
    .not('amazon_sp_refresh_token', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!users || users.length === 0) return NextResponse.json({ ok: true, processed: 0 })

  let processed = 0
  let failed = 0

  for (const user of users) {
    // Rate-limit SP-API calls — /seller/v1/account/health/ratings has a 2 req/s restore rate
    if (processed + failed > 0) await new Promise(r => setTimeout(r, 600))
    try {
      const accessToken = await getAccessToken(user.amazon_sp_refresh_token)
      const apiUrl = user.amazon_sp_api_url ?? 'https://sellingpartnerapi-na.amazon.com'

      // Default to US marketplace — seller can set preferred marketplace later
      const marketplaceId = MARKETPLACE_IDS['amazon.com']

      const health = await fetchAccountHealth(apiUrl, accessToken, marketplaceId)
      if (!health) { failed++; continue }

      // Store SC scan record
      await admin.from('sc_scans').insert({
        user_id: user.id,
        scan_type: 'account_health',
        data: {
          health_score: health.healthScore,
          status: health.status,
          suspension_threshold: health.suspensionThreshold,
          source: 'sp_api',
          captured_at: new Date().toISOString(),
        },
      })

      // Alert thresholds
      const alerts: Array<{ title: string; body: string; severity: string }> = []
      if (health.healthScore < 200) {
        alerts.push({
          title: 'Critical Account Health',
          body: `Account Health Rating is ${health.healthScore} — suspension threshold is ${health.suspensionThreshold}. Immediate action required.`,
          severity: 'critical',
        })
      } else if (health.healthScore < 400) {
        alerts.push({
          title: 'Low Account Health Rating',
          body: `Account Health Rating is ${health.healthScore}. Review your performance metrics in Seller Central.`,
          severity: 'warning',
        })
      }
      if (health.status === 'AT_RISK') {
        alerts.push({
          title: 'Account Health At Risk',
          body: `Amazon has flagged your account as At Risk. Check Seller Central immediately.`,
          severity: 'critical',
        })
      }

      const today = new Date().toISOString().split('T')[0]
      for (const alert of alerts) {
        const { data: existing } = await admin
          .from('alerts')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'account_health')
          .eq('title', alert.title)
          .gte('created_at', `${today}T00:00:00Z`)
          .maybeSingle()
        if (!existing) {
          await admin.from('alerts').insert({
            user_id: user.id,
            type: 'account_health',
            severity: alert.severity,
            title: alert.title,
            body: alert.body,
            data: health,
          })
        }
      }

      // Heartbeat: update last_sc_sync on users table
      await admin.from('users').update({
        amazon_sp_last_sync: new Date().toISOString(),
      }).eq('id', user.id)

      processed++
    } catch (e) {
      console.error(`[account-health cron] Failed for user ${user.id}:`, e)
      failed++
    }
  }

  return NextResponse.json({ ok: true, processed, failed })
}
