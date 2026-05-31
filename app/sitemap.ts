import { MetadataRoute } from 'next'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    {
      url: 'https://voxrate.app',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://voxrate.app/faq',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://voxrate.app/blog',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://voxrate.app/terms',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://voxrate.app/privacy',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  try {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // Blog posts
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('published', true)

    for (const p of posts || []) {
      base.push({
        url: `https://voxrate.app/blog/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      })
    }

    // GEO product pages — high priority, frequently updated
    const { data: geoPages } = await supabase
      .from('public_geo_pages')
      .select('slug, last_snapshot_at, updated_at')
      .eq('published', true)
      .order('last_snapshot_at', { ascending: false })
      .limit(5000)

    for (const g of geoPages || []) {
      base.push({
        url: `https://voxrate.app/product/${g.slug}`,
        lastModified: g.last_snapshot_at ? new Date(g.last_snapshot_at) : new Date(g.updated_at),
        changeFrequency: 'weekly',
        priority: 0.9,
      })
    }
  } catch {
    // sitemap should never fail the build — fall through with static entries
  }

  return base
}
