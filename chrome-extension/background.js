// Voxrate Extension — Background Service Worker (Manifest V3)

const API_BASE = 'https://voxrate.app/api/extension'
const POLL_ALARM = 'voxrate-poll'
const POLL_INTERVAL_MINUTES = 0.5 // 30 seconds

// ── State ────────────────────────────────────────────────────────
let activeJobTabId = null
let activeJobId = null
let activeJob = null        // full job object — content.js pulls this
let activeJobToken = null
let stats = { jobsToday: 0, lastAsin: null, lastJobAt: null }

// ── Bootstrap ────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  setupAlarm()
  loadStats()
  poll()
})

chrome.runtime.onStartup.addListener(() => {
  setupAlarm()
  loadStats()
  poll()
})

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
  // Match by tab ID, or by ASIN if tab ID hasn't been stored yet (race condition safety).
  if (msg.type === 'CONTENT_READY') {
    const senderTabId = sender.tab?.id
    const matchByTab  = activeJobTabId && senderTabId === activeJobTabId
    const matchByAsin = activeJob && msg.url && msg.url.includes(activeJob.asin)

    if (activeJob && (matchByTab || matchByAsin)) {
      // Record tab ID in case we got here via ASIN match before tabs.create resolved
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
      lastAsin: stored.statsLastAsin || null,
      lastJobAt: stored.statsLastJobAt || null,
    }
  }
}

async function saveStats() {
  await chrome.storage.local.set({
    statsJobsToday: stats.jobsToday,
    statsLastAsin: stats.lastAsin,
    statsLastJobAt: stats.lastJobAt,
    statsDate: new Date().toDateString(),
  })
}

// ── Status for popup ─────────────────────────────────────────────

async function getStatus() {
  const stored = await chrome.storage.local.get(['extensionToken', 'statsJobsToday', 'statsLastAsin', 'statsLastJobAt', 'statsDate'])
  const today = new Date().toDateString()
  return {
    connected: !!stored.extensionToken,
    busy: activeJobTabId !== null,
    jobsToday: stored.statsDate === today ? (stored.statsJobsToday || 0) : 0,
    lastAsin: stored.statsLastAsin || null,
    lastJobAt: stored.statsLastJobAt || null,
  }
}

// ── Poll loop ─────────────────────────────────────────────────────

async function poll() {
  if (activeJobTabId !== null) return

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
  activeJobId = job.id
  activeJob = job
  activeJobToken = token

  const { asin, marketplace } = job
  const url = `https://www.${marketplace}/product-reviews/${asin}?pageNumber=1&reviewerType=all_reviews&sortBy=recent`

  console.log(`[Voxrate] Starting job ${job.id}: ${asin}`)

  // Hard timeout — backend waits 100s, we give 120s
  const hardTimeoutId = setTimeout(() => {
    if (activeJobId !== job.id) return
    console.warn('[Voxrate] Job hard timeout')
    submitJob(job.id, [], true, token, 'timeout')
    if (activeJobTabId) cleanupTab(activeJobTabId)
    stats.jobsToday++
    stats.lastAsin = asin
    stats.lastJobAt = new Date().toISOString()
    saveStats()
  }, 120000)

  try {
    const tab = await chrome.tabs.create({ url, active: false })
    activeJobTabId = tab.id
    console.log(`[Voxrate] Tab ${tab.id} opened for ${asin}`)
    // content.js auto-injects via manifest and will send CONTENT_READY when ready.
    // We just wait — no sendMessage, no frame errors.
  } catch (err) {
    clearTimeout(hardTimeoutId)
    console.error('[Voxrate] Could not create tab:', err)
    submitJob(job.id, [], false, token, err.message)
    cleanupState()
  }
}

// ── Handlers called by content.js messages ───────────────────────

async function handleReviewsDone(msg) {
  const { jobId, reviews, amazonLoggedIn, asin } = msg
  if (jobId !== activeJobId) return

  const token = activeJobToken
  await submitJob(jobId, reviews, amazonLoggedIn, token, null)

  const tabId = activeJobTabId
  cleanupState()
  if (tabId) chrome.tabs.remove(tabId).catch(() => {})

  stats.jobsToday++
  stats.lastAsin = asin
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
  activeJobTabId = null
  activeJobId = null
  activeJob = null
  activeJobToken = null
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

// Legacy — kept for safety
function cleanupTab(tabId) {
  if (tabId) chrome.tabs.remove(tabId).catch(() => {})
  cleanupState()
}
