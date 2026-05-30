'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PricingSection from '@/app/components/sections/PricingSection'

export default function PricingPageClient() {
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [calcProducts, setCalcProducts] = useState(5)
  const [calcFrequency, setCalcFrequency] = useState<'monthly' | 'quarterly'>('monthly')

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
        <Link href="/" className="text-lg font-black tracking-tight text-neutral-900">
          Voxrate
        </Link>
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800 transition-colors">
          ← Back to home
        </Link>
      </header>
      <PricingSection
        billingCycle={billingCycle}
        setBillingCycle={setBillingCycle}
        calcProducts={calcProducts}
        setCalcProducts={setCalcProducts}
        calcFrequency={calcFrequency}
        setCalcFrequency={setCalcFrequency}
        openAuthModal={() => router.push('/?auth=signup')}
      />
    </div>
  )
}
