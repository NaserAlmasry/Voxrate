import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { checkCsrf } from '@/app/lib/csrf'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('monitored_asins')
    .select('id, user_id, asin, marketplace, product_name, main_image, is_own_product, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ asins: data ?? [] })
}

export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { asin: string; marketplace?: string; product_name?: string; main_image?: string; is_own_product?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { asin, marketplace = 'amazon.com', product_name, main_image, is_own_product = true } = body
  if (!asin || !/^[A-Z0-9]{10}$/.test(asin.trim().toUpperCase())) {
    return NextResponse.json({ error: 'Invalid ASIN' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('monitored_asins')
    .upsert({
      user_id: user.id,
      asin: asin.trim().toUpperCase(),
      marketplace,
      product_name: product_name || null,
      main_image: main_image || null,
      is_own_product,
    }, { onConflict: 'user_id,asin' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ asin: data })
}

export async function DELETE(req: NextRequest) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const asin = searchParams.get('asin')
  if (!asin) return NextResponse.json({ error: 'Missing asin' }, { status: 400 })

  const { error } = await supabase
    .from('monitored_asins')
    .delete()
    .eq('user_id', user.id)
    .eq('asin', asin.toUpperCase())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
