// app/blog/[slug]/page.tsx — public blog post page (server component)

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { marked } from 'marked'
import { createClient } from '@/app/lib/supabase/server'

export const revalidate = 300

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
  updated_at: string | null
  views: number
}

async function fetchPost(slug: string): Promise<Post | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()
  if (!data) return null
  // increment view count fire-and-forget
  supabase.rpc('increment_blog_views', { post_slug: slug }).then(() => {})
  return (data as Post) || null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await fetchPost(slug)
  if (!post) {
    return { title: 'Post not found | Voxrate' }
  }
  const title = post.seo_title || `${post.title} | Voxrate Blog`
  const description = post.seo_description || post.excerpt || 'Amazon seller insights from Voxrate.'
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      images: post.cover_image ? [post.cover_image] : undefined,
    },
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await fetchPost(slug)
  if (!post) notFound()

  const html = marked.parse(post.content) as string

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

      <article className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/blog" className="text-sm text-orange-600 hover:underline mb-8 inline-block">
          ← Back to blog
        </Link>

        <header className="mb-10">
          <div className="flex items-center gap-3 text-xs text-neutral-400 mb-3">
            <span>{formatDate(post.published_at)}</span>
            {post.views > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  {post.views.toLocaleString()} views
                </span>
              </>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-4">{post.title}</h1>
          {post.excerpt && (
            <p className="text-lg text-neutral-600 leading-relaxed">{post.excerpt}</p>
          )}
        </header>

        {post.cover_image && (
          <div className="rounded-2xl overflow-hidden border border-neutral-200 mb-10">
            <img src={post.cover_image} alt={post.title} className="w-full h-auto" />
          </div>
        )}

        <div
          className="voxrate-prose"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <div className="mt-16 pt-8 border-t border-neutral-200">
          <Link href="/blog" className="text-sm text-orange-600 hover:underline">
            ← Back to blog
          </Link>
        </div>
      </article>

      <style>{`
        .voxrate-prose {
          color: #262626;
          font-size: 1.05rem;
          line-height: 1.75;
        }
        .voxrate-prose h1 { font-size: 2rem; font-weight: 700; margin: 2.5rem 0 1rem; line-height: 1.2; }
        .voxrate-prose h2 { font-size: 1.6rem; font-weight: 700; margin: 2.25rem 0 0.85rem; line-height: 1.25; }
        .voxrate-prose h3 { font-size: 1.3rem; font-weight: 600; margin: 1.75rem 0 0.65rem; line-height: 1.3; }
        .voxrate-prose h4 { font-size: 1.1rem; font-weight: 600; margin: 1.5rem 0 0.5rem; }
        .voxrate-prose p  { margin: 0 0 1.15rem; }
        .voxrate-prose a  { color: #ea580c; text-decoration: underline; text-underline-offset: 2px; }
        .voxrate-prose a:hover { color: #c2410c; }
        .voxrate-prose ul, .voxrate-prose ol { margin: 0 0 1.25rem 1.5rem; padding: 0; }
        .voxrate-prose ul { list-style: disc; }
        .voxrate-prose ol { list-style: decimal; }
        .voxrate-prose li { margin: 0.4rem 0; }
        .voxrate-prose li > p { margin: 0; }
        .voxrate-prose blockquote {
          border-left: 3px solid #fb923c;
          padding: 0.25rem 0 0.25rem 1.1rem;
          margin: 1.5rem 0;
          color: #525252;
          font-style: italic;
        }
        .voxrate-prose code {
          background: #f5f5f4;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-size: 0.92em;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .voxrate-prose pre {
          background: #1c1917;
          color: #fafafa;
          padding: 1rem 1.15rem;
          border-radius: 12px;
          overflow-x: auto;
          margin: 1.5rem 0;
          font-size: 0.9rem;
          line-height: 1.6;
        }
        .voxrate-prose pre code { background: transparent; padding: 0; color: inherit; }
        .voxrate-prose hr { border: 0; border-top: 1px solid #e5e5e5; margin: 2.5rem 0; }
        .voxrate-prose img { max-width: 100%; height: auto; border-radius: 12px; margin: 1.5rem 0; }
        .voxrate-prose table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.95rem; }
        .voxrate-prose th, .voxrate-prose td { border: 1px solid #e5e5e5; padding: 0.55rem 0.75rem; text-align: left; }
        .voxrate-prose th { background: #fafafa; font-weight: 600; }
        .voxrate-prose strong { font-weight: 600; color: #171717; }
      `}</style>
    </div>
  )
}
