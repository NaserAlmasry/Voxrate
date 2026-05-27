'use client'

import { useState, useEffect } from 'react'

export default function ExtensionSettingsPage() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(null)
  const [tokenSent, setTokenSent] = useState(false)

  useEffect(() => {
    fetchToken()
    detectExtension()
  }, [])

  // Once we have the token, broadcast it to the extension via postMessage
  useEffect(() => {
    if (!token || tokenSent) return
    window.postMessage({ type: 'VOXRATE_EXTENSION_TOKEN', token }, '*')
    setTokenSent(true)
  }, [token, tokenSent])

  async function fetchToken() {
    setLoading(true)
    try {
      const res = await fetch('/api/extension/token')
      const data = await res.json()
      if (data.token) setToken(data.token)
    } finally {
      setLoading(false)
    }
  }

  async function regenerateToken() {
    setRegenerating(true)
    try {
      const res = await fetch('/api/extension/token', { method: 'POST' })
      const data = await res.json()
      if (data.token) {
        setToken(data.token)
        setTokenSent(false) // re-broadcast new token
      }
    } finally {
      setRegenerating(false)
    }
  }

  function copyToken() {
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function detectExtension() {
    // Listen for the extension's handshake reply
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'VOXRATE_EXTENSION_INSTALLED') {
        setExtensionInstalled(true)
        window.removeEventListener('message', handler)
      }
    }
    window.addEventListener('message', handler)
    // If no reply in 1.5s, extension isn't installed
    setTimeout(() => {
      setExtensionInstalled(prev => prev === null ? false : prev)
      window.removeEventListener('message', handler)
    }, 1500)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Chrome Extension</h1>

      {/* Status card */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h2 className="text-sm font-semibold text-neutral-700 mb-4">Status</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-600">Extension installed</p>
            {extensionInstalled === null ? (
              <span className="text-xs text-neutral-400">Checking…</span>
            ) : extensionInstalled ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Installed
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-400">
                <span className="w-2 h-2 rounded-full bg-neutral-300 inline-block" />
                Not detected
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-600">Connection</p>
            {extensionInstalled && token ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Connected automatically
              </span>
            ) : (
              <span className="text-xs text-neutral-400">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Install card */}
      {!extensionInstalled && (
        <div className="bg-orange-50 rounded-2xl border border-orange-200 p-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-orange-800 mb-1">Install the extension first</p>
              <p className="text-xs text-orange-600 leading-relaxed mb-3">
                The Voxrate extension runs in your browser to scrape Amazon reviews using your own logged-in session — bypassing Amazon&apos;s login wall that blocks all server-side scrapers.
              </p>
              <a
                href="https://chrome.google.com/webstore"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-xs font-semibold rounded-xl hover:bg-orange-600 transition-colors"
              >
                Install from Chrome Web Store
              </a>
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h2 className="text-sm font-semibold text-neutral-700 mb-4">How it works</h2>
        <ol className="space-y-3">
          {[
            { n: '1', text: 'You submit a product to analyze on Voxrate' },
            { n: '2', text: 'Voxrate sends a job to your extension in the background' },
            { n: '3', text: 'The extension silently opens a hidden Amazon tab — using your logged-in session' },
            { n: '4', text: 'It collects all the review text and sends it back to Voxrate' },
            { n: '5', text: 'The tab closes automatically. You see the full analysis.' },
          ].map(step => (
            <li key={step.n} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {step.n}
              </span>
              <p className="text-sm text-neutral-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Token card */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h2 className="text-sm font-semibold text-neutral-700 mb-1">Your connection token</h2>
        <p className="text-xs text-neutral-400 mb-4">
          If the extension didn&apos;t connect automatically, copy this token and paste it in the extension popup.
        </p>

        {loading ? (
          <div className="h-10 bg-neutral-100 rounded-xl animate-pulse" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs text-neutral-700 truncate select-all">
              {token}
            </div>
            <button
              onClick={copyToken}
              className="px-4 py-2.5 text-xs font-semibold border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors whitespace-nowrap"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between">
          <p className="text-xs text-neutral-400">Regenerating creates a new token and disconnects the old one.</p>
          <button
            onClick={regenerateToken}
            disabled={regenerating}
            className="px-3 py-1.5 text-xs font-medium text-neutral-500 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* Privacy note */}
      <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl">
        <p className="text-xs text-neutral-500 leading-relaxed">
          <span className="font-medium text-neutral-700">Privacy: </span>
          The extension only opens tabs on amazon.com domains and only communicates with voxrate.app.
          It never stores your Amazon credentials and only reads review text — nothing else.
        </p>
      </div>
    </div>
  )
}
