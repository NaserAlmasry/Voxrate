import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import GeoPageClient from './GeoPageClient'

export const revalidate = 3600

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getPage(slug: string) {
  const admin = adminClient()
  const { data } = await admin
    .from('public_geo_pages')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) return { title: 'Not Found' }

  const safeTotal   = page.total_reviews ?? 0
  const title       = `${page.product_title} — Verified Amazon Review Analysis`
  const description = `${page.product_title} has a review health score of ${page.health_score}/100 based on ${safeTotal.toLocaleString()} verified Amazon reviews. See what buyers actually say.`
  const url         = `https://voxrate.app/product/${slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Voxrate',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    other: {
      'og:image': `${url}/opengraph-image`,
    },
  }
}

export default async function GeoProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) notFound()

  const safeTotal    = page.total_reviews ?? 0
  const complaints   = Array.isArray(page.complaints) ? page.complaints : []
  const strengths    = Array.isArray(page.strengths)  ? page.strengths  : []
  const buyerPhrases = Array.isArray(page.buyer_phrases) ? page.buyer_phrases : []
  const starBreakdown = page.star_breakdown || {}

  // Build FAQ entries for schema
  const faqEntries: { question: string; answer: string }[] = []

  if (complaints.length > 0 && page.show_complaints) {
    faqEntries.push({
      question: `What do buyers complain about most with ${page.product_title}?`,
      answer: [
        complaints[0].title,
        complaints[0].percentage != null ? `(${complaints[0].percentage}% of reviews)` : '',
        complaints[0].description ?? '',
      ].filter(Boolean).join(' ').trim(),
    })
  }
  if (strengths.length > 0 && page.show_strengths) {
    faqEntries.push({
      question: `What do customers love about ${page.product_title}?`,
      answer: `${strengths[0].title}. ${strengths[0].marketingAngle ?? ''}`.trim(),
    })
  }
  faqEntries.push({
    question: `What is the review health score for ${page.product_title}?`,
    answer: `${page.product_title} has a review health score of ${page.health_score}/100 based on analysis of ${safeTotal.toLocaleString()} customer reviews on Amazon.`,
  })
  if (buyerPhrases.length > 0) {
    faqEntries.push({
      question: `What phrases do buyers use when reviewing ${page.product_title}?`,
      answer: `Customers commonly use phrases like: ${buyerPhrases.slice(0, 5).map((p: string) => `"${p}"`).join(', ')}.`,
    })
  }
  faqEntries.push({
    question: `Is ${page.product_title} worth buying?`,
    answer: page.health_score >= 75
      ? `With a health score of ${page.health_score}/100, ${page.product_title} receives strong reviews from verified buyers. ${strengths[0]?.title ?? ''}`
      : page.health_score >= 50
      ? `${page.product_title} has a review health score of ${page.health_score}/100. Buyers appreciate some aspects but also report issues — read the full analysis before purchasing.`
      : `${page.product_title} has a review health score of ${page.health_score}/100. A notable portion of buyers report concerns. Review the complaint analysis carefully.`,
  })

  // JSON-LD schemas
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: page.product_title,
    ...(page.product_image ? { image: page.product_image } : {}),
    description: page.seller_bio || page.summary?.slice(0, 200) || `Verified Amazon review analysis for ${page.product_title}.`,
    offers: {
      '@type': 'Offer',
      url: page.amazon_url,
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'Amazon' },
    },
    ...(page.avg_rating && page.total_reviews > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: String(page.avg_rating),
        bestRating: '5',
        worstRating: '1',
        reviewCount: String(page.total_reviews),
      },
    } : {}),
  }

  const faqSchema = faqEntries.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntries.map(e => ({
      '@type': 'Question',
      name: e.question,
      acceptedAnswer: { '@type': 'Answer', text: e.answer },
    })),
  } : null

  // No Review schema — complaint data is aggregate analysis, not individual reviews.
  // Using Review schema here would be misleading to Google and AI crawlers.
  const reviewSchemas: any[] = []

  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Voxrate',
    url: 'https://voxrate.app',
    sameAs: [
      'https://www.linkedin.com/company/voxrate',
      'https://www.crunchbase.com/organization/voxrate',
    ],
  }

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${page.product_title} — Verified Amazon Review Analysis`,
    url: `https://voxrate.app/product/${slug}`,
    description: `Review health score ${page.health_score}/100 — analysis of ${safeTotal.toLocaleString()} verified Amazon reviews.`,
    dateModified: page.last_snapshot_at,
    publisher: { '@type': 'Organization', name: 'Voxrate', url: 'https://voxrate.app' },
    about: { '@type': 'Product', name: page.product_title },
  }

  return (
    <>
      {/* JSON-LD Schema Markup */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}
      {reviewSchemas.map((s: any, i: number) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />

      <GeoPageClient
        page={page}
        complaints={complaints}
        strengths={strengths}
        buyerPhrases={buyerPhrases}
        starBreakdown={starBreakdown}
        faqEntries={faqEntries}
        slug={slug}
      />
    </>
  )
}

