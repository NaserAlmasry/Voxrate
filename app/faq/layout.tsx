import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ – Voxrate Etsy Review Analyzer',
  description: 'Common questions about Voxrate — how it works, pricing, credits, competitor analysis, and data privacy for Etsy sellers.',
  alternates: { canonical: 'https://voxrate.app/faq' },
  openGraph: {
    title: 'FAQ – Voxrate Etsy Review Analyzer',
    description: 'Everything Etsy sellers ask before signing up. Credits, competitor analysis, privacy, and more.',
    url: 'https://voxrate.app/faq',
  },
}

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Does this work for any Etsy product?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes — Voxrate works for any product category on Etsy, from jewelry and ceramics to digital downloads and clothing. Best results come from listings with 30+ reviews.' },
    },
    {
      '@type': 'Question',
      name: 'What if my listing has very few reviews?',
      acceptedAnswer: { '@type': 'Answer', text: 'The analysis will still run with fewer reviews, but insights will be limited. For the most reliable patterns, 50+ reviews is ideal.' },
    },
    {
      '@type': 'Question',
      name: 'How is Voxrate different from other Etsy tools?',
      acceptedAnswer: { '@type': 'Answer', text: 'Most Etsy tools tell you what buyers search for before they buy. Voxrate tells you what buyers say after they buy — complaints, praise, and specific fixes. Use keyword tools to get found, use Voxrate to improve what happens after they find you.' },
    },
    {
      '@type': 'Question',
      name: "Can I analyze a competitor's listing?",
      acceptedAnswer: { '@type': 'Answer', text: "Yes. You can paste any public Etsy listing URL — including competitors'. Voxrate will analyze their reviews, show you their top weaknesses, what they do well, and give you a side-by-side comparison. Competitor analysis costs 48 credits." },
    },
    {
      '@type': 'Question',
      name: 'What are credits and do they expire?',
      acceptedAnswer: { '@type': 'Answer', text: 'Credits are the currency used for analyses. Each own-listing analysis costs 24 credits. Each competitor analysis costs 48 credits. All other tools are free. Credits purchased in one-time packs never expire. Subscription credits refresh monthly.' },
    },
    {
      '@type': 'Question',
      name: "Is my data and my customers' data private?",
      acceptedAnswer: { '@type': 'Answer', text: "Voxrate only analyzes publicly available review text from Etsy. We don't access your Etsy account, private messages, or order data. Your generated reports are private to your account." },
    },
  ],
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      {children}
    </>
  )
}
