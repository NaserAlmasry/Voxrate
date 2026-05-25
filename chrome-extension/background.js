// Voxrate Extension — Background Service Worker (Manifest V3)

const API_BASE = 'https://voxrate.app/api/extension'
const POLL_ALARM = 'voxrate-poll'
const POLL_INTERVAL_MINUTES = 0.5 // 30 seconds

// ── State ────────────────────────────────────────────────────────
let activeJobTabId  = null
let activeJobId     = null
let activeJob       = null
let activeJobToken  = null
let activeTimeoutId = null  // hoisted so cleanupState can cancel it
let stats = { jobsToday: 0, lastAsin: null, lastJobAt: null }

// ── Bootstrap ────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  setupAlarm()
  loadStats()
  registerVisibilitySpoofer()
  poll()
})

chrome.runtime.onStartup.addListener(() => {
  setupAlarm()
  loadStats()
  registerVisibilitySpoofer()
  poll()
})

// Register visibilitySpoofer.js in the MAIN world at document_start.
// This must run before Amazon's JS reads document.visibilityState, otherwise
// Amazon detects the hidden background tab and returns the same reviews for
// every page (bot-detection based on Page Visibility API).
function registerVisibilitySpoofer() {
  const SPOOFER_ID = 'voxrate-visibility-spoofer'
  const amazonMatches = [
    'https://www.amazon.com/product-reviews/*',
    'https://www.amazon.co.uk/product-reviews/*',
    'https://www.amazon.de/product-reviews/*',
    'https://www.amazon.fr/product-reviews/*',
    'https://www.amazon.it/product-reviews/*',
    'https://www.amazon.es/product-reviews/*',
    'https://www.amazon.ca/product-reviews/*',
    'https://www.amazon.com.au/product-reviews/*',
    'https://www.amazon.co.jp/product-reviews/*',
    'https://www.amazon.in/product-reviews/*',
    'https://www.amazon.com.mx/product-reviews/*',
    'https://www.amazon.com.br/product-reviews/*',
  ]
  // Unregister first (handles extension update — old registration may exist)
  chrome.scripting.unregisterContentScripts({ ids: [SPOOFER_ID] }, () => {
    chrome.runtime.lastError // consume
    chrome.scripting.registerContentScripts([{
      id:      SPOOFER_ID,
      matches: amazonMatches,
      js:      ['visibilitySpoofer.js'],
      runAt:   'document_start',
      world:   'MAIN',
    }], () => {
      if (chrome.runtime.lastError) {
        console.warn('[Voxrate] visibilitySpoofer registration failed:', chrome.runtime.lastError.message)
      } else {
        console.log('[Voxrate] visibilitySpoofer registered (MAIN world, document_start)')
      }
    })
  })
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) poll()
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATUS') {
    getStatus().then(sendResponse)
    return true
  }

  if (msg.type === 'SET_TOKEN') {
    chrome.storage.local.set({ extensionToken: msg.token }, () => {
      sendResponse({ ok: true })
      poll()
    })
    return true
  }

  if (msg.type === 'CLEAR_TOKEN') {
    chrome.storage.local.remove('extensionToken', () => sendResponse({ ok: true }))
    return true
  }

  if (msg.type === 'VOXRATE_TOKEN') {
    chrome.storage.local.set({ extensionToken: msg.token }, () => {
      console.log('[Voxrate] Token auto-captured from voxrate.app page')
    })
    return
  }

  // content.js loads on Amazon review page and asks: "do you have a job for me?"
  // Content script initiates — background never messages into a tab — no frame errors possible.
  if (msg.type === 'CONTENT_READY') {
    const senderTabId = sender.tab?.id
    const matchByTab  = activeJobTabId && senderTabId === activeJobTabId
    const matchByAsin = activeJob && msg.url && msg.url.includes(activeJob.asin)

    if (activeJob && (matchByTab || matchByAsin)) {
      if (senderTabId && !activeJobTabId) activeJobTabId = senderTabId
      console.log(`[Voxrate] Content script ready — sending job ${activeJob.id}`)
      sendResponse({ job: activeJob })
    } else {
      sendResponse({ job: null })
    }
    return true
  }

  if (msg.type === 'REVIEWS_DONE') {
    handleReviewsDone(msg)
    return
  }

  if (msg.type === 'AMAZON_NOT_LOGGED_IN') {
    handleAmazonNotLoggedIn(msg.jobId)
    return
  }

  if (msg.type === 'CONTENT_LOG') {
    console.log(`[Voxrate:content] ${msg.msg}`)
    return
  }
})

function setupAlarm() {
  chrome.alarms.get(POLL_ALARM, (existing) => {
    if (!existing) chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_INTERVAL_MINUTES })
  })
}

async function loadStats() {
  const stored = await chrome.storage.local.get(['statsJobsToday', 'statsLastAsin', 'statsLastJobAt', 'statsDate'])
  const today = new Date().toDateString()
  if (stored.statsDate !== today) {
    stats = { jobsToday: 0, lastAsin: null, lastJobAt: null }
  } else {
    stats = {
      jobsToday: stored.statsJobsToday || 0,
      lastAsin:  stored.statsLastAsin  || null,
      lastJobAt: stored.statsLastJobAt || null,
    }
  }
}

async function saveStats() {
  await chrome.storage.local.set({
    statsJobsToday: stats.jobsToday,
    statsLastAsin:  stats.lastAsin,
    statsLastJobAt: stats.lastJobAt,
    statsDate:      new Date().toDateString(),
  })
}

// ── Status for popup ─────────────────────────────────────────────

async function getStatus() {
  const stored = await chrome.storage.local.get(['extensionToken', 'statsJobsToday', 'statsLastAsin', 'statsLastJobAt', 'statsDate'])
  const today = new Date().toDateString()
  return {
    connected:  !!stored.extensionToken,
    busy:       activeJobTabId !== null,
    jobsToday:  stored.statsDate === today ? (stored.statsJobsToday || 0) : 0,
    lastAsin:   stored.statsLastAsin  || null,
    lastJobAt:  stored.statsLastJobAt || null,
  }
}

// ── Poll loop ─────────────────────────────────────────────────────

async function poll() {
  // Guard on both — activeJobTabId isn't set until tabs.create resolves
  if (activeJobId !== null || activeJobTabId !== null) return

  const { extensionToken } = await chrome.storage.local.get('extensionToken')
  if (!extensionToken) return

  let job
  try {
    const res = await fetch(`${API_BASE}/jobs`, {
      headers: { 'Authorization': `Bearer ${extensionToken}` },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 401) {
      chrome.storage.local.remove('extensionToken')
      return
    }
    if (!res.ok) return
    const data = await res.json()
    job = data.job
  } catch {
    return
  }

  if (!job) return

  startJob(job, extensionToken)
}

// ── Job execution ─────────────────────────────────────────────────

async function startJob(job, token) {
  activeJobId    = job.id
  activeJob      = job
  activeJobToken = token

  const { asin, marketplace } = job
  const url = `https://www.${marketplace}/product-reviews/${asin}?pageNumber=1&reviewerType=all_reviews&sortBy=recent`

  console.log(`[Voxrate] Starting job ${job.id}: ${asin}`)

  // Hoisted timeout — cleared in cleanupState() so it never leaks
  activeTimeoutId = setTimeout(() => {
    if (activeJobId !== job.id) return
    console.warn('[Voxrate] Job hard timeout')
    submitJob(job.id, [], false, token, 'timeout') // false — login state unknown on timeout
    if (activeJobTabId) chrome.tabs.remove(activeJobTabId).catch(() => {})
    stats.jobsToday++
    stats.lastAsin  = asin
    stats.lastJobAt = new Date().toISOString()
    saveStats()
    cleanupState()
  }, 120000)

  // Use callback form — avoids Promise rejection that Chrome intercepts before our catch.
  // chrome.runtime.lastError is set for real failures; frame errors are Amazon redirects
  // and are recoverable (tab was created, content.js will inject and send CONTENT_READY).
  chrome.tabs.create({ url, active: false }, (tab) => {
    const err = chrome.runtime.lastError
    if (err) {
      if (err.message?.includes('Frame')) {
        console.log('[Voxrate] Amazon redirect during tab create — waiting for CONTENT_READY')
        // Tab was created despite the error; ASIN-match in CONTENT_READY will recover tab ID
      } else {
        console.error('[Voxrate] Could not create tab:', err.message)
        submitJob(job.id, [], false, token, err.message)
        cleanupState()
      }
      return
    }
    activeJobTabId = tab.id
    console.log(`[Voxrate] Tab ${tab.id} opened for ${asin}`)
  })
}

// ── Handlers called by content.js messages ───────────────────────

async function handleReviewsDone(msg) {
  const { jobId, reviews, amazonLoggedIn, asin } = msg
  if (jobId !== activeJobId) return

  const token = activeJobToken
  const tabId = activeJobTabId
  cleanupState() // clears timeout before submit so it can't double-fire
  await submitJob(jobId, reviews, amazonLoggedIn, token, null)
  if (tabId) chrome.tabs.remove(tabId).catch(() => {})

  stats.jobsToday++
  stats.lastAsin  = asin
  stats.lastJobAt = new Date().toISOString()
  saveStats()
}

async function handleAmazonNotLoggedIn(jobId) {
  if (jobId !== activeJobId) return
  const token = activeJobToken
  const tabId = activeJobTabId
  cleanupState()
  await submitJob(jobId, [], false, token, 'amazon_not_logged_in')
  if (tabId) chrome.tabs.remove(tabId).catch(() => {})
}

function cleanupState() {
  if (activeTimeoutId !== null) {
    clearTimeout(activeTimeoutId)
    activeTimeoutId = null
  }
  activeJobTabId  = null
  activeJobId     = null
  activeJob       = null
  activeJobToken  = null
}

// ── Submit ────────────────────────────────────────────────────────

async function submitJob(jobId, reviews, amazonLoggedIn, token, error) {
  try {
    await fetch(`${API_BASE}/submit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, reviews, amazonLoggedIn, error }),
      signal: AbortSignal.timeout(15000),
    })
    console.log(`[Voxrate] Submitted job ${jobId}: ${(reviews || []).length} reviews`)
  } catch (e) {
    console.error('[Voxrate] Submit failed:', e)
  }
}
