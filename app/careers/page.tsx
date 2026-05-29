'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DollarSign, Award, Crown, Briefcase, CheckCircle2, ArrowRight } from 'lucide-react'

export default function CareersPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !email.trim() || !code.trim()) {
      setError('Please fill in all fields.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/ambassador/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ name, email, code }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Could not validate code')
        setSubmitting(false)
        return
      }
      localStorage.setItem('voxrate_amb_token', data.sessionToken)
      router.push('/careers/dashboard')
    } catch {
      setError('Network error')
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight">Voxrate</Link>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">Back to site</Link>
      </header>

      <section className="px-6 py-20 max-w-4xl mx-auto text-center animate-fadeIn">
        <p className="text-xs uppercase tracking-widest text-[#f05a1e] font-semibold mb-4">Voxrate Ambassadors</p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Earn 30% on every customer you bring.
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Join as a Brand Ambassador. 3-month commission-based internship, real earnings, certificate of completion, and a path to a full-time role.
        </p>
      </section>

      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-4 gap-4 scroll-fade">
          {[
            { icon: DollarSign, title: 'Commission', body: '$4.50 – $17.99 per sale, recurring' },
            { icon: Award, title: 'Certificate', body: 'Official letter upon completion' },
            { icon: Crown, title: 'Pro Access', body: 'Free Voxrate Pro on request' },
            { icon: Briefcase, title: 'Career Path', body: 'Full-time after 12 months' },
          ].map((c, i) => (
            <div key={i} className="card-lift p-6 rounded-2xl border border-gray-100 bg-white">
              <c.icon className="w-6 h-6 text-[#f05a1e] mb-3" />
              <h3 className="font-bold mb-1">{c.title}</h3>
              <p className="text-sm text-gray-600">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '1', t: 'Apply', b: 'Tell us who you are and where you reach Amazon sellers.' },
              { n: '2', t: 'Get accepted', b: 'Receive your invite code and personal referral link.' },
              { n: '3', t: 'Start earning', b: 'Share your link. Get 30% of every paying customer, recurring.' },
            ].map(s => (
              <div key={s.n} className="card-lift p-6 rounded-2xl bg-white border border-gray-100">
                <div className="w-10 h-10 rounded-full bg-[#f05a1e] text-white font-bold flex items-center justify-center mb-4">{s.n}</div>
                <h3 className="font-bold text-lg mb-1">{s.t}</h3>
                <p className="text-sm text-gray-600">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">What you earn per referral</h2>
        <div className="overflow-hidden rounded-2xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
              <tr><th className="text-left px-6 py-4">Plan</th><th className="text-left px-6 py-4">Monthly</th><th className="text-right px-6 py-4">Your commission</th></tr>
            </thead>
            <tbody>
              {[
                { p: 'Starter', m: '$14.99', c: '$4.50' },
                { p: 'Growth', m: '$39.99', c: '$11.99' },
                { p: 'Pro', m: '$59.99', c: '$17.99' },
              ].map(r => (
                <tr key={r.p} className="border-t border-gray-100">
                  <td className="px-6 py-4 font-semibold">{r.p}</td>
                  <td className="px-6 py-4 text-gray-600">{r.m}</td>
                  <td className="px-6 py-4 text-right text-[#f05a1e] font-bold">{r.c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 text-center mt-4">Recurring for as long as they stay subscribed.</p>
        <p className="text-xs text-[#f05a1e] text-center mt-1 font-medium">+$2/month extra when you refer a friend ambassador who brings their first customer.</p>
      </section>

      <section className="px-6 py-20 bg-gray-50">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 p-8 glow-orange">
            <h2 className="text-2xl font-bold mb-2">Apply now</h2>
            <p className="text-sm text-gray-600 mb-6">Have an invite code? Activate your ambassador account.</p>
            <form onSubmit={submit} className="space-y-4">
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#f05a1e] focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#f05a1e] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Invite code (AMB-XXXX-XXXX)"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#f05a1e] focus:outline-none font-mono"
              />
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-start gap-2">
                  <span>{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[#f05a1e] text-white font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? 'Activating...' : <>Activate ambassador account <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
            <p className="text-xs text-gray-400 text-center mt-4 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Codes expire 24 hours after issue.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 px-6 py-8 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} Voxrate &middot; <Link href="/" className="hover:text-gray-900">Home</Link>
      </footer>
    </main>
  )
}
