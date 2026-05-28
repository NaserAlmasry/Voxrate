import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ – Voxrate Amazon Review Analyzer',
  description: 'Common questions about Voxrate — how it works, pricing, analyses, competitor analysis, and data privacy for Amazon sellers.',
  alternates: { canonical: 'https://voxrate.app/faq' },
  openGraph: {
    title: 'FAQ – Voxrate Amazon Review Analyzer',
    description: 'Everything Amazon sellers ask before signing up. Pricing, analyses, competitor analysis, privacy, and more.',
    url: 'https://voxrate.app/faq',
  },
}

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Does this work for any Amazon product?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes — Voxrate works for any product category on Amazon, from electronics and kitchen goods to clothing and supplements. Best results come from listings with 30+ reviews.' },
    },
    {
      '@type': 'Question',
      name: 'What if my listing has very few reviews?',
      acceptedAnswer: { '@type': 'Answer', text: 'The analysis will still run with fewer reviews, but insights will be limited. For the most reliable patterns, 50+ reviews is ideal.' },
    },
    {
      '@type': 'Question',
      name: 'How is Voxrate different from other Amazon tools?',
      acceptedAnswer: { '@type': 'Answer', text: 'Most Amazon tools tell you what buyers search for before they buy. Voxrate tells you what buyers say after they buy — complaints, praise, and specific fixes. Use keyword tools to get found, use Voxrate to improve what happens after they find you.' },
    },
    {
      '@type': 'Question',
      name: "Can I analyze a competitor's listing?",
      acceptedAnswer: { '@type': 'Answer', text: "Yes. You can paste any public Amazon listing URL — including competitors'. Voxrate will analyze their reviews, show you their top weaknesses, what they do well, and give you a side-by-side comparison. Competitor analyses use 1 analysis from your monthly quota, same as own listings." },
    },
    {
      '@type': 'Question',
      name: 'How does the analysis quota work?',
      acceptedAnswer: { '@type': 'Answer', text: 'Each analysis — whether your own listing or a competitor — uses 1 analysis from your monthly quota. All other tools are free. Subscription analyses refresh monthly on the 1st.' },
    },
    {
      '@type': 'Question',
      name: "Is my data and my customers' data private?",
      acceptedAnswer: { '@type': 'Answer', text: "Voxrate only analyzes publicly available review text from Amazon. We don't access your Amazon account, private messages, or order data. Your generated reports are private to your account." },
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
