// app/api/blog/route.ts
// Public GETs for fetching posts; admin-gated POST/PUT/DELETE.

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: me } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  return { service, user }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug')
  const list = url.searchParams.get('list')
  const all = url.searchParams.get('all')

  // Admin-only: list all (including drafts)
  if (all === 'true') {
    const admin = await requireAdmin()
    if ('error' in admin) return admin.error
    const { data, error } = await admin.service!
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ posts: data || [] })
  }

  const supabase = await createClient()

  if (slug) {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ post: data })
  }

  if (list === 'true') {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image, published_at')
      .eq('published', true)
      .order('published_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ posts: data || [] })
  }

  return NextResponse.json({ error: 'Missing slug or list param' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error
  const body = await request.json().catch(() => ({}))
  const {
    title,
    slug,
    excerpt,
    content,
    seo_title,
    seo_description,
    cover_image,
    published,
  } = body || {}

  if (!title || !content) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
  }

  const finalSlug = (slug && String(slug).trim()) ? slugify(String(slug)) : slugify(String(title))

  const insert: any = {
    title,
    slug: finalSlug,
    excerpt: excerpt ?? null,
    content,
    seo_title: seo_title ?? null,
    seo_description: seo_description ?? null,
    cover_image: cover_image ?? null,
    published: !!published,
  }
  if (published) insert.published_at = new Date().toISOString()

  const { data, error } = await admin.service!
    .from('blog_posts')
    .insert(insert)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/blog')
  if (data?.slug) revalidatePath(`/blog/${data.slug}`)
  return NextResponse.json({ post: data })
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error
  const body = await request.json().catch(() => ({}))
  const { id, ...rest } = body || {}
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Fetch current to detect transitions
  const { data: current, error: fetchErr } = await admin.service!
    .from('blog_posts')
    .select('published, published_at')
    .eq('id', id)
    .single()
  if (fetchErr || !current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const update: any = { ...rest, updated_at: new Date().toISOString() }

  if (rest.title && !rest.slug) {
    // Don't auto re-slug on every update — only if explicit slug given, re-slugify it
  }
  if (rest.slug) update.slug = slugify(String(rest.slug))

  // Detect false → true on published
  if (typeof rest.published === 'boolean') {
    if (rest.published && !current.published) {
      update.published_at = new Date().toISOString()
    }
  }

  const { data, error } = await admin.service!
    .from('blog_posts')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/blog')
  if (data?.slug) revalidatePath(`/blog/${data.slug}`)
  return NextResponse.json({ post: data })
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const { error } = await admin.service!.from('blog_posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
