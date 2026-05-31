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
              {[['#features','Features',false],['#how-it-works','How it works',false],['#pricing','Pricing',false],['/extension','Chrome Extension',true],['/blog','Blog',true],['/faq','FAQ',true],['/privacy','Privacy policy',true],['/terms','Terms of service',true],['/careers','Careers',true]].map(([h,l,blank]) => (
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
        {/* Trust badges */}
        <div className="pt-4 pb-5 flex flex-col sm:flex-row items-center justify-center gap-4 border-t border-neutral-100">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span className="text-xs">Secured by</span>
            {/* Stripe wordmark */}
            <svg width="34" height="14" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Stripe">
              <path d="M59.6 13.2c0-4.4-2.1-7.9-6.2-7.9s-6.6 3.5-6.6 7.8c0 5.2 2.9 7.7 7.1 7.7 2 0 3.6-.5 4.7-1.1v-3.4c-1.1.6-2.4.9-4 .9-1.6 0-3-.5-3.1-2.4h7.9c.1-.3.2-1.2.2-1.6zm-8-1.6c0-1.8 1.1-2.5 2.1-2.5s2 .7 2 2.5h-4.1zM41.3 5.3c-1.6 0-2.7.8-3.3 1.3l-.2-1h-3.7v20.1l4.2-1v-5c.6.4 1.5 1 3 1 3 0 5.8-2.4 5.8-7.9-.1-5-2.9-7.5-5.8-7.5zm-1 11.5c-1 0-1.6-.4-2-.9V10c.4-.6 1.1-.9 2-.9 1.5 0 2.6 1.7 2.6 3.8 0 2.2-1 3.9-2.6 3.9zM31.3 4l-4.2 1V.7l4.2-1V4zM27.1 5.6h4.2v14.9h-4.2V5.6zM22.6 7l-.3-1.4h-3.6v14.9h4.2v-10c1-1.3 2.7-1.1 3.2-.9V5.5c-.5-.2-2.5-.5-3.5 1.5zM14.9 2.4l-4.1 1-.1 11.5c0 2.1 1.6 3.7 3.7 3.7 1.2 0 2-.2 2.5-.5v-3.4c-.5.2-2.8.8-2.8-1.3V9h2.8V5.6h-2.8l-.2-3.2zM4.7 9.4c0-.7.5-.9 1.4-.9 1.3 0 2.9.4 4.2 1.1V5.9c-1.4-.6-2.8-.8-4.2-.8C2.4 5.1 0 6.8 0 10c0 4.9 6.8 4.1 6.8 6.2 0 .8-.7 1-1.7 1-1.4 0-3.3-.6-4.7-1.4v3.8c1.6.7 3.2 1 4.7 1 3.6 0 6.1-1.8 6.1-5-.1-5.2-6.5-4.3-6.5-6.2z" fill="#6772E5"/>
            </svg>
          </div>
          <div className="w-px h-4 bg-neutral-200 hidden sm:block" />
          <div className="flex items-center gap-1.5 text-neutral-400">
            <span className="text-xs">Pay with</span>
            {/* PayPal wordmark */}
            <svg width="50" height="14" viewBox="0 0 100 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="PayPal">
              <path d="M39.4 5.3h-6.3c-.4 0-.8.3-.9.7L29.6 20c-.1.3.1.6.4.6h3c.4 0 .8-.3.9-.7l.6-3.7c.1-.4.4-.7.9-.7h2c4.1 0 6.5-2 7.1-5.9.3-1.7 0-3-.8-3.9-.9-1-2.5-1.3-4.3-1.3zM40 11.2c-.3 2.2-2 2.2-3.7 2.2h-.9l.7-4.2c0-.3.3-.4.5-.4h.4c1.1 0 2.2 0 2.7.6.3.4.4 1 .3 1.8zM57.4 11.1h-3c-.3 0-.5.1-.5.4l-.1.8-.2-.3c-.7-.9-2.1-1.3-3.6-1.3-3.4 0-6.3 2.6-6.8 6.2-.3 1.8.1 3.5 1.1 4.7 1 1.1 2.3 1.5 3.9 1.5 2.8 0 4.3-1.8 4.3-1.8l-.1.8c-.1.3.1.6.4.6h2.7c.4 0 .8-.3.9-.7l1.6-9.6c.1-.3-.1-.6-.5-.6h-.1zm-4.2 6c-.3 1.8-1.7 3-3.5 3-.9 0-1.6-.3-2-.8-.4-.5-.6-1.3-.4-2.1.3-1.8 1.8-3 3.5-3 .9 0 1.6.3 2 .8.4.6.5 1.3.4 2.1zM74.1 11.1h-3c-.3 0-.6.2-.8.4L67 17.1l-1.6-5.3c-.1-.4-.5-.7-.9-.7h-2.9c-.4 0-.6.3-.5.6l2.9 8.6-2.7 3.9c-.2.3 0 .8.4.8h3c.3 0 .6-.2.8-.4l8.8-12.7c.2-.4 0-.8-.2-.8z" fill="#253B80"/>
              <path d="M81.6 5.3h-6.3c-.4 0-.8.3-.9.7L71.8 20c-.1.3.1.6.4.6h3.2c.3 0 .5-.2.6-.5l.6-3.9c.1-.4.4-.7.9-.7h2c4.1 0 6.5-2 7.1-5.9.3-1.7 0-3-.8-3.9-1-.9-2.5-1.3-4.2-1.3zm.5 5.9c-.3 2.2-2 2.2-3.7 2.2h-.9l.7-4.2c0-.3.3-.4.5-.4h.4c1.1 0 2.2 0 2.7.6.4.4.4 1 .3 1.8zM99 11.1h-3c-.3 0-.5.1-.5.4l-.1.8-.2-.3c-.7-.9-2.1-1.3-3.6-1.3-3.4 0-6.3 2.6-6.8 6.2-.3 1.8.1 3.5 1.1 4.7 1 1.1 2.3 1.5 3.9 1.5 2.8 0 4.3-1.8 4.3-1.8l-.1.8c-.1.3.1.6.4.6h2.7c.4 0 .8-.3.9-.7l1.6-9.6c.1-.3-.2-.6-.6-.6zm-4.2 6c-.3 1.8-1.7 3-3.5 3-.9 0-1.6-.3-2-.8-.4-.5-.6-1.3-.4-2.1.3-1.8 1.8-3 3.5-3 .9 0 1.6.3 2 .8.4.6.5 1.3.4 2.1zM102.4 5.6l-2.7 17.1c-.1.3.1.6.4.6h2.6c.4 0 .8-.3.9-.7l2.7-17.1c.1-.3-.1-.6-.4-.6h-2.9c-.3.1-.5.3-.6.7z" fill="#179BD7"/>
            </svg>
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
