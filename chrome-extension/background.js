// Voxrate Extension — Background Service Worker (Manifest V3)
// Polls voxrate.app for pending scrape jobs, opens hidden Amazon tabs,
// collects reviews via content.js, and POSTs results back.

const API_BASE = 'https://voxrate.app/api/extension'
const POLL_ALARM = 'voxrate-poll'
const POLL_INTERVAL_MINUTES = 0.083 // ~5 seconds (minimum chrome.alarms resolution is 0.5m in prod, but works in dev)

// ── State (in-memory; rebuilt on SW wake) ────────────────────────
let activeJobTabId = null
let activeJobId = null
let stats = { jobsToday: 0, lastAsin: null, lastJobAt: null }

// ── Bootstrap ────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  setupAlarm()
  loadStats()
})

chrome.runtime.onStartup.addListener(() => {
  setupAlarm()
  loadStats()
})

// Wake on alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) poll()
})

// Wake on message from popup or voxrate-bridge.js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_STATUS') {
    getStatus().then(sendResponse)
    return true
  }
  if (msg.type === 'SET_TOKEN') {
    chrome.storage.local.set({ extensionToken: msg.token }, () => {
      sendResponse({ ok: true })
      poll() // immediate poll after token set
    })
    return true
  }
  if (msg.type === 'CLEAR_TOKEN') {
    chrome.storage.local.remove('extensionToken', () => sendResponse({ ok: true }))
    return true
  }
  if (msg.type === 'VOXRATE_TOKEN') {
    // Sent by voxrate-bridge.js when user visits voxrate.app
    chrome.storage.local.set({ extensionToken: msg.token }, () => {
      console.log('[Voxrate] Token auto-captured from voxrate.app page')
    })
  }
  // Sent by content.js when review parsing is done
  if (msg.type === 'REVIEWS_DONE') {
    handleReviewsDone(msg)
  }
  if (msg.type === 'AMAZON_NOT_LOGGED_IN') {
    handleAmazonNotLoggedIn(msg.jobId)
  }
})

function setupAlarm() {
  chrome.alarms.get(POLL_ALARM, (existing) => {
    if (!existing) {
      chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_INTERVAL_MINUTES })
    }
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
  const jobsToday = stored.statsDate === today ? (stored.statsJobsToday || 0) : 0
  return {
    connected: !!stored.extensionToken,
    busy: activeJobTabId !== null,
    jobsToday,
    lastAsin: stored.statsLastAsin || null,
    lastJobAt: stored.statsLastJobAt || null,
  }
}

// ── Main poll loop ────────────────────────────────────────────────

async function poll() {
  if (activeJobTabId !== null) return // already processing a job

  const { extensionToken } = await chrome.storage.local.get('extensionToken')
  if (!extensionToken) return

  let job
  try {
    const res = await fetch(`${API_BASE}/jobs`, {
      headers: { 'Authorization': `Bearer ${extensionToken}` },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 401) {
      console.warn('[Voxrate] Token rejected — clearing')
      chrome.storage.local.remove('extensionToken')
      return
    }
    if (!res.ok) return
    const data = await res.json()
    job = data.job
  } catch (e) {
    // Network error — silent fail, will retry
    return
  }

  if (!job) return // no pending jobs

  startJob(job, extensionToken)
}

// ── Job execution ─────────────────────────────────────────────────

async function startJob(job, token) {
  activeJobId = job.id
  const { asin, marketplace, maxReviews } = job
  const tld = marketplace.replace('amazon.', '')
  const url = `https://www.${marketplace}/product-reviews/${asin}?pageNumber=1&reviewerType=all_reviews&sortBy=recent`

  console.log(`[Voxrate] Starting job ${job.id}: ${asin} on ${marketplace}`)

  let tabId
  try {
    const tab = await chrome.tabs.create({ url, active: false })
    tabId = tab.id
    activeJobTabId = tabId

    // Wait for tab to finish loading
    await waitForTabLoad(tabId)

    // Inject content script and start scraping
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    })

    // Send job config to content script
    await chrome.tabs.sendMessage(tabId, {
      type: 'START_SCRAPE',
      jobId: job.id,
      asin,
      marketplace,
      maxReviews: maxReviews || 150,
    })

    // content.js will message back REVIEWS_DONE or AMAZON_NOT_LOGGED_IN
    // Set a 90-second timeout as safety net
    setTimeout(() => {
      if (activeJobId === job.id) {
        console.warn('[Voxrate] Job timeout — submitting empty result')
        submitJob(job.id, [], true, token, 'timeout')
        cleanupTab(tabId)
      }
    }, 90000)

  } catch (err) {
    console.error('[Voxrate] Job start error:', err)
    await submitJob(job.id, [], false, token, err.message)
    if (tabId) cleanupTab(tabId)
  }
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Tab load timeout')), 30000)
    chrome.tabs.onUpdated.addListener(function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timeout)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    })
  })
}

async function handleReviewsDone(msg) {
  const { jobId, reviews, amazonLoggedIn } = msg
  if (jobId !== activeJobId) return

  const { extensionToken } = await chrome.storage.local.get('extensionToken')
  await submitJob(jobId, reviews, amazonLoggedIn, extensionToken, null)
  cleanupTab(activeJobTabId)

  stats.jobsToday++
  stats.lastAsin = msg.asin
  stats.lastJobAt = new Date().toISOString()
  saveStats()
}

async function handleAmazonNotLoggedIn(jobId) {
  if (jobId !== activeJobId) return
  const { extensionToken } = await chrome.storage.local.get('extensionToken')
  await submitJob(jobId, [], false, extensionToken, 'amazon_not_logged_in')
  cleanupTab(activeJobTabId)
}

async function submitJob(jobId, reviews, amazonLoggedIn, token, error) {
  try {
    await fetch(`${API_BASE}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId, reviews, amazonLoggedIn, error }),
      signal: AbortSignal.timeout(15000),
    })
    console.log(`[Voxrate] Submitted job ${jobId}: ${reviews.length} reviews`)
  } catch (e) {
    console.error('[Voxrate] Submit failed:', e)
  }
}

function cleanupTab(tabId) {
  if (tabId) {
    chrome.tabs.remove(tabId).catch(() => {})
  }
  activeJobTabId = null
  activeJobId = null
}
