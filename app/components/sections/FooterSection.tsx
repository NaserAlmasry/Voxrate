'use client'

type Props = {
  footerNlEmail: string
  setFooterNlEmail: (v: string) => void
  footerNlSubmitted: boolean
  setFooterNlSubmitted: (v: boolean) => void
  saveNewsletter: (email: string) => Promise<void>
}

export default function FooterSection({ footerNlEmail, setFooterNlEmail, footerNlSubmitted, setFooterNlSubmitted, saveNewsletter }: Props) {
  return (
    <footer className="py-12 px-6 border-t border-neutral-200 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <img src="/logo.png" alt="Voxrate" height={28} style={{ objectFit: 'contain', maxWidth: 130 }} className="mb-3" />
            <p className="text-xs text-neutral-400 leading-relaxed">The Amazon review analyzer that turns customer feedback into specific fixes. Free to try.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">Product</p>
            <div className="space-y-2">
              {[['#features','Features',false],['#how-it-works','How it works',false],['#pricing','Pricing',false],['/blog','Blog',true],['/faq','FAQ',true],['/privacy','Privacy policy',true],['/terms','Terms of service',true],['/careers','Careers',true]].map(([h,l,blank]) => (
                <a key={String(l)} href={String(h)} target={blank ? '_blank' : undefined} rel={blank ? 'noopener noreferrer' : undefined}
                  className="block text-xs text-neutral-400 hover:text-black transition-colors">{l}</a>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">Stay in the loop</p>
            <p className="text-xs text-neutral-500 mb-3">New features, tips, and exclusive discounts for Amazon sellers.</p>
            {footerNlSubmitted ? (
              <p className="text-xs text-green-600 font-medium">Thanks! We&apos;ll be in touch.</p>
            ) : (
              <div className="flex gap-2">
                <input type="email" value={footerNlEmail} onChange={e => setFooterNlEmail(e.target.value)}
                  onKeyDown={async e => { if (e.key === 'Enter' && footerNlEmail.includes('@')) { await saveNewsletter(footerNlEmail); setFooterNlSubmitted(true) } }}
                  placeholder="your@email.com"
                  className="flex-1 px-3 py-2 text-xs border border-neutral-200 rounded-lg outline-none focus:border-orange-400 transition-colors" />
                <button onClick={async () => { if (footerNlEmail.includes('@')) { await saveNewsletter(footerNlEmail); setFooterNlSubmitted(true) } }}
                  className="px-3 py-2 text-xs font-medium bg-black text-white rounded-lg hover:bg-neutral-800 transition-colors">Join</button>
              </div>
            )}
            <p className="text-xs text-neutral-400 mt-2">
              Questions? <a href="mailto:info@voxrate.app" className="text-orange-500 hover:underline">info@voxrate.app</a>
            </p>
          </div>
        </div>
        <div className="pt-6 border-t border-neutral-100 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs text-neutral-400">© 2026 Voxrate</p>
          <div className="flex items-center gap-4 text-xs text-neutral-400">
            <a href="/faq" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">FAQ</a>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Privacy</a>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Terms</a>
            <a href="/careers" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Careers</a>
            <a href="/extension" className="hover:text-black transition-colors">Extension</a>
            <a href="mailto:info@voxrate.app" className="hover:text-black transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
