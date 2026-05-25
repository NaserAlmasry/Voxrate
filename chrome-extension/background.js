// Voxrate Extension — Background Service Worker (Manifest V3)
// Polls voxrate.app for pending scrape jobs, opens hidden Amazon tabs,
// collects reviews via content.js, and POSTs results back.

const API_BASE = 'https://voxrate.app/api/extension'
const POLL_ALARM = 'voxrate-poll'
const POLL_INTERVAL_MINUTES = 0.5 // 30 seconds — Chrome's minimum reliable alarm period for unpacked extensions

// ── State (in-memory; rebuilt on SW wake) ────────────────────────
let activeJobTabId = null
let activeJobId = null
let stats = { jobsToday: 0, lastAsin: null, lastJobAt: null }

// ── Bootstrap ────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  setupAlarm()
  loadStats()
  poll() // immediate first poll
})

chrome.runtime.onStartup.addListener(() => {
  setupAlarm()
  loadStats()
  poll() // immediate first poll
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
  const url = `https://www.${marketplace}/product-reviews/${asin}?pageNumber=1&reviewerType=all_reviews&sortBy=recent`

  console.log(`[Voxrate] Starting job ${job.id}: ${asin} on ${marketplace}`)

  let tabId
  const hardTimeoutId = setTimeout(() => {
    if (activeJobId === job.id) {
      console.warn('[Voxrate] Job hard timeout')
      submitJob(job.id, [], true, token, 'timeout')
      if (tabId) cleanupTab(tabId)
      stats.jobsToday++
      stats.lastAsin = asin
      stats.lastJobAt = new Date().toISOString()
      saveStats()
    }
  }, 120000)

  try {
    const tab = await chrome.tabs.create({ url, active: false })
    tabId = tab.id
    activeJobTabId = tabId

    // Wait for the tab to fully load AND verify it landed on an Amazon page
    await waitForTabStable(tabId, marketplace)

    // Inject content script — retry once if frame was replaced during navigation
    let injected = false
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
        injected = true
        break
      } catch (e) {
        if (attempt === 0 && e.message.includes('Frame')) {
          // Frame was replaced by a redirect — wait for the next stable load
          await waitForTabStable(tabId, marketplace)
        } else {
          throw e
        }
      }
    }

    if (!injected) throw new Error('Could not inject content script after redirect')

    // Send job config to content script
    await chrome.tabs.sendMessage(tabId, {
      type: 'START_SCRAPE',
      jobId: job.id,
      asin,
      marketplace,
      maxReviews: maxReviews || 150,
    })

  } catch (err) {
    clearTimeout(hardTimeoutId)
    console.error('[Voxrate] Job start error:', err)
    await submitJob(job.id, [], false, token, err.message)
    if (tabId) cleanupTab(tabId)
  }
}

// Waits for the tab to reach 'complete' status on an Amazon domain.
// Handles redirects by waiting for the NEXT complete event if the URL isn't Amazon yet.
function waitForTabStable(tabId, marketplace) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error('Tab load timeout after 35s'))
    }, 35000)

    function check(tab) {
      if (!tab || chrome.runtime.lastError) return
      if (tab.status === 'complete' && tab.url && tab.url.includes(marketplace)) {
        clearTimeout(timeout)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
      // If status=complete but wrong URL (redirect), keep listening for next load
    }

    function listener(id, info, tab) {
      if (id !== tabId) return
      if (info.status === 'complete') {
        chrome.tabs.get(tabId, check)
      }
    }

    chrome.tabs.onUpdated.addListener(listener)

    // Check current state immediately in case tab already loaded
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return
      check(tab)
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
