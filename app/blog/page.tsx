// app/blog/page.tsx — public blog index (server component)

import Link from 'next/link'
import { createClient } from '@/app/lib/supabase/server'

export const metadata = {
  title: 'Blog – Amazon Seller Tips & Strategies | Voxrate',
  description: 'Amazon seller tips, listing optimization strategies, and review analysis guides from the Voxrate team.',
}

export const revalidate = 300

type Post = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  cover_image: string | null
  published_at: string | null
  views: number
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

export default async function BlogIndexPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('blog_posts')
    .select('id, title, slug, excerpt, cover_image, published_at, views')
    .eq('published', true)
    .order('published_at', { ascending: false })

  const posts: Post[] = (data as Post[] | null) || []

  return (
    <div className="min-h-screen bg-[#FAF9F6] font-[DM_Sans] text-neutral-900">
      {/* Top nav */}
      <nav className="bg-[#FAF9F6]/85 backdrop-blur-lg border-b border-neutral-200/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <img src="/logo.png" alt="Voxrate" height={36} style={{ objectFit: 'contain', maxWidth: 160 }} />
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm text-neutral-600">
            <Link href="/#features" className="hover:text-black transition-colors">Features</Link>
            <Link href="/#how-it-works" className="hover:text-black transition-colors">How it works</Link>
            <Link href="/#pricing" className="hover:text-black transition-colors">Pricing</Link>
            <Link href="/blog" className="text-black font-medium">Blog</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-10 text-center">
        <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-3">Voxrate Blog</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Amazon Seller Resources</h1>
        <p className="text-lg text-neutral-600">Tips, strategies, and data for Amazon sellers</p>
      </section>

      {/* Posts grid */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        {posts.length === 0 ? (
          <div className="max-w-md mx-auto bg-white border border-neutral-200 rounded-2xl p-12 text-center">
            <p className="text-neutral-500">Coming soon — tips for Amazon sellers</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(p => (
              <Link
                key={p.id}
                href={`/blog/${p.slug}`}
                className="group bg-white border border-neutral-200 rounded-2xl overflow-hidden hover:border-orange-300 hover:shadow-sm transition-all flex flex-col"
              >
                {p.cover_image && (
                  <div className="aspect-[16/9] bg-neutral-100 overflow-hidden">
                    <img src={p.cover_image} alt={p.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                  </div>
                )}
                <div className="p-6 flex flex-col flex-1">
                  <p className="text-xs text-neutral-400 mb-2">{formatDate(p.published_at)}</p>
                  <h2 className="text-lg font-semibold text-neutral-900 mb-2 leading-snug group-hover:text-orange-600 transition-colors">
                    {p.title}
                  </h2>
                  {p.excerpt && (
                    <p className="text-sm text-neutral-600 leading-relaxed line-clamp-3 mb-4">{p.excerpt}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-sm text-orange-600 font-medium">Read more →</span>
                    {p.views > 0 && (
                      <span className="text-xs text-neutral-400 flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        {p.views.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
