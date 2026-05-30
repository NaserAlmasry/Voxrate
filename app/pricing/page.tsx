import type { Metadata } from 'next'
import PricingPageClient from './PricingPageClient'

export const metadata: Metadata = {
  title: 'Pricing — Voxrate',
  description: 'Simple, generous pricing for Amazon FBA sellers. Plans from $14.99/month with rollover analyses.',
}

export default function PricingPage() {
  return <PricingPageClient />
}
