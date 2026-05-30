import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// GET /api/amazon/connect
// Initiates SP-API LWA OAuth flow. Redirects seller to Amazon's authorization page.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appId = process.env.AMAZON_SP_APP_ID
  if (!appId) return NextResponse.json({ error: 'SP-API not configured' }, { status: 500 })

  // Cryptographically random state to prevent CSRF
  const state = `${user.id}:${crypto.randomUUID()}`
  const stateB64 = Buffer.from(state).toString('base64url')

  // Store state with 10-min TTL so callback can verify it
  const admin = adminClient()
  await admin.from('amazon_oauth_states').insert({
    user_id: user.id,
    state: stateB64,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })

  // Detect marketplace from query param (default: US)
  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region') || 'us'
  const baseUrls: Record<string, string> = {
    us: 'https://sellercentral.amazon.com',
    uk: 'https://sellercentral.amazon.co.uk',
    eu: 'https://sellercentral-europe.amazon.com',
    jp: 'https://sellercentral.amazon.co.jp',
  }
  const baseUrl = baseUrls[region] ?? baseUrls.us

  const authUrl = `${baseUrl}/apps/authorize/consent?application_id=${appId}&state=${stateB64}&version=beta`
  return NextResponse.redirect(authUrl)
}

// DELETE /api/amazon/connect  — disconnect SP-API
export async function DELETE(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  await admin.from('users').update({
    amazon_sp_refresh_token: null,
    amazon_sp_selling_partner_id: null,
    amazon_sp_marketplace_id: null,
    amazon_sp_connected_at: null,
    amazon_sp_region: null,
  }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
