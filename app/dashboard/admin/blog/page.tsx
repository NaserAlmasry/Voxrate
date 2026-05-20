'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Post = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  seo_title: string | null
  seo_description: string | null
  cover_image: string | null
  published: boolean
  published_at: string | null
  created_at: string
  updated_at: string | null
}

type Draft = {
  id?: string
  title: string
  slug: string
  excerpt: string
  content: string
  seo_title: string
  seo_description: string
  cover_image: string
  published: boolean
}

const EMPTY_DRAFT: Draft = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  seo_title: '',
  seo_description: '',
  cover_image: '',
  published: false,
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

export default function AdminBlogPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slugPreview = useMemo(() => {
    if (draft.slug && draft.slug.trim()) return slugify(draft.slug)
    return slugify(draft.title || 'your-slug-here')
  }, [draft.title, draft.slug])

  async function loadPosts() {
    const res = await fetch('/api/blog?all=true')
    if (!res.ok) return
    const j = await res.json()
    setPosts(j.posts || [])
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: me } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
      if (!me?.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)
      await loadPosts()
      setLoading(false)
    }
    init()
  }, [])

  function openNew() {
    setDraft(EMPTY_DRAFT)
    setError(null)
    setEditorOpen(true)
  }

  function openEdit(p: Post) {
    setDraft({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt || '',
      content: p.content || '',
      seo_title: p.seo_title || '',
      seo_description: p.seo_description || '',
      cover_image: p.cover_image || '',
      published: !!p.published,
    })
    setError(null)
    setEditorOpen(true)
  }

  async function save() {
    if (!draft.title.trim() || !draft.content.trim()) {
      setError('Title and content are required')
      return
    }
    setSaving(true)
    setError(null)
    const method = draft.id ? 'PUT' : 'POST'
    const body = draft.id ? { ...draft } : { ...draft }
    const res = await fetch('/api/blog', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Save failed')
      return
    }
    setEditorOpen(false)
    setDraft(EMPTY_DRAFT)
    await loadPosts()
  }

  async function togglePublish(p: Post) {
    const res = await fetch('/api/blog', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, published: !p.published }),
    })
    if (res.ok) await loadPosts()
  }

  async function remove(p: Post) {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return
    const res = await fetch(`/api/blog?id=${p.id}`, { method: 'DELETE' })
    if (res.ok) await loadPosts()
  }

  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="h-8 w-40 bg-neutral-100 rounded-lg animate-pulse" />
      <div className="h-64 bg-neutral-100 rounded-2xl animate-pulse" />
    </div>
  )

  if (!authorized) return null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Blog</h1>
          <p className="text-xs text-neutral-400 mt-0.5">Manage public blog posts — admin only</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full border border-red-200">ADMIN</span>
          <button
            type="button"
            onClick={openNew}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + New post
          </button>
        </div>
      </div>

      {/* Posts table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">All posts ({posts.length})</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left">
                <th className="px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase">Title</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-neutral-400 uppercase">Status</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-neutral-400 uppercase">Published</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-neutral-400 uppercase">Updated</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-neutral-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {posts.map(p => (
                <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-5 py-3 max-w-[320px]">
                    <p className="font-medium text-neutral-800 truncate">{p.title}</p>
                    <p className="text-[11px] text-neutral-400 truncate">/blog/{p.slug}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      p.published ? 'bg-green-50 text-green-600' : 'bg-neutral-100 text-neutral-500'
                    }`}>
                      {p.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-neutral-500 text-xs">{formatDate(p.published_at)}</td>
                  <td className="px-3 py-3 text-neutral-400 text-xs">{formatDate(p.updated_at || p.created_at)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => togglePublish(p)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      >
                        {p.published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-sm text-neutral-400 text-center">No posts yet — click "New post" to write your first.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor slide-over */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close editor"
            onClick={() => !saving && setEditorOpen(false)}
            className="flex-1 bg-black/30 backdrop-blur-sm"
          />
          <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">{draft.id ? 'Edit post' : 'New post'}</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="px-6 py-6 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Title</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={e => setDraft({ ...draft, title: e.target.value })}
                  placeholder="How to optimize your Amazon listing"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-orange-400 transition-colors"
                />
                <p className="text-[11px] text-neutral-400 mt-1.5">
                  voxrate.app/blog/<span className="font-medium text-neutral-600">{slugPreview}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Slug (optional override)</label>
                <input
                  type="text"
                  value={draft.slug}
                  onChange={e => setDraft({ ...draft, slug: e.target.value })}
                  placeholder="auto-generated from title"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-orange-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Excerpt</label>
                <textarea
                  value={draft.excerpt}
                  onChange={e => setDraft({ ...draft, excerpt: e.target.value })}
                  rows={2}
                  placeholder="A 1-2 sentence summary shown in the blog list."
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-orange-400 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Cover image URL (optional)</label>
                <input
                  type="text"
                  value={draft.cover_image}
                  onChange={e => setDraft({ ...draft, cover_image: e.target.value })}
                  placeholder="https://…"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-orange-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
                  Content <span className="text-neutral-400 font-normal normal-case">— supports markdown</span>
                </label>
                <textarea
                  value={draft.content}
                  onChange={e => setDraft({ ...draft, content: e.target.value })}
                  rows={16}
                  placeholder={'# Heading\n\nWrite your post in markdown…'}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-orange-400 transition-colors font-mono"
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 space-y-5">
                <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">SEO</p>

                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
                    SEO title <span className="text-neutral-400 font-normal normal-case">({draft.seo_title.length} chars)</span>
                  </label>
                  <input
                    type="text"
                    value={draft.seo_title}
                    onChange={e => setDraft({ ...draft, seo_title: e.target.value })}
                    placeholder="Falls back to title if empty"
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-orange-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
                    SEO description <span className={`font-normal normal-case ${draft.seo_description.length > 160 ? 'text-red-500' : 'text-neutral-400'}`}>
                      ({draft.seo_description.length}/160 chars)
                    </span>
                  </label>
                  <textarea
                    value={draft.seo_description}
                    onChange={e => setDraft({ ...draft, seo_description: e.target.value })}
                    rows={3}
                    placeholder="Falls back to excerpt if empty. Aim for ≤160 chars."
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-orange-400 transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.published}
                    onChange={e => setDraft({ ...draft, published: e.target.checked })}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <span className="text-sm font-medium text-neutral-800">Published</span>
                  <span className="text-xs text-neutral-400">— visible at /blog when checked</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
