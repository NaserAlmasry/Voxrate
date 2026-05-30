import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const REGION_TOKEN_URLS: Record<string, string> = {
  na: 'https://api.amazon.com/auth/o2/token',
  eu: 'https://api.amazon.co.uk/auth/o2/token',
  fe: 'https://api.amazon.co.jp/auth/o2/token',
}

const REGION_API_URLS: Record<string, string> = {
  na: 'https://sellingpartnerapi-na.amazon.com',
  eu: 'https://sellingpartnerapi-eu.amazon.com',
  fe: 'https://sellingpartnerapi-fe.amazon.com',
}

function detectRegion(spApiOauthCode: string, sellingPartnerId: string): string {
  // Amazon doesn't tell us the region in the callback — infer from selling_partner_id prefix
  // or default to NA. Sellers can re-auth for other regions.
  if (sellingPartnerId.startsWith('A') && sellingPartnerId.length === 13) return 'eu'
  return 'na'
}

// GET /api/amazon/callback
// Amazon redirects here after seller grants access.
// Query params: spapi_oauth_code, state, selling_partner_id
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('spapi_oauth_code')
  const state = searchParams.get('state')
  const sellingPartnerId = searchParams.get('selling_partner_id')
  const errorParam = searchParams.get('error')

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://voxrate.app'}/dashboard/settings`

  if (errorParam) {
    return NextResponse.redirect(`${dashboardUrl}?amazon_error=${encodeURIComponent(errorParam)}`)
  }

  if (!code || !state || !sellingPartnerId) {
    return NextResponse.redirect(`${dashboardUrl}?amazon_error=missing_params`)
  }

  const admin = adminClient()

  // Validate state and extract user_id
  const { data: stateRow, error: stateErr } = await admin
    .from('amazon_oauth_states')
    .select('user_id, expires_at, region')
    .eq('state', state)
    .single()

  if (stateErr || !stateRow) {
    return NextResponse.redirect(`${dashboardUrl}?amazon_error=invalid_state`)
  }
  if (new Date(stateRow.expires_at) < new Date()) {
    return NextResponse.redirect(`${dashboardUrl}?amazon_error=state_expired`)
  }
  // Clean up used state
  await admin.from('amazon_oauth_states').delete().eq('state', state)

  const userId = stateRow.user_id
  const region = (stateRow.region && REGION_TOKEN_URLS[stateRow.region])
    ? stateRow.region
    : detectRegion(code, sellingPartnerId)
  const tokenUrl = REGION_TOKEN_URLS[region]

  // Exchange authorization code for LWA tokens
  let refreshToken: string
  try {
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://voxrate.app'}/api/amazon/callback`,
        client_id: process.env.AMAZON_LWA_CLIENT_ID!,
        client_secret: process.env.AMAZON_LWA_CLIENT_SECRET!,
      }),
    })
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      console.error('[Amazon OAuth] Token exchange failed:', errBody)
      return NextResponse.redirect(`${dashboardUrl}?amazon_error=token_exchange_failed`)
    }
    const tokens = await tokenRes.json()
    refreshToken = tokens.refresh_token
    if (!refreshToken) throw new Error('No refresh_token in response')
  } catch (e) {
    console.error('[Amazon OAuth] Exception during token exchange:', e)
    return NextResponse.redirect(`${dashboardUrl}?amazon_error=token_exchange_exception`)
  }

  // Persist connection in users table
  await admin.from('users').update({
    amazon_sp_refresh_token: refreshToken,
    amazon_sp_selling_partner_id: sellingPartnerId,
    amazon_sp_region: region,
    amazon_sp_api_url: REGION_API_URLS[region],
    amazon_sp_connected_at: new Date().toISOString(),
  }).eq('id', userId)

  return NextResponse.redirect(`${dashboardUrl}?amazon_connected=true`)
}
