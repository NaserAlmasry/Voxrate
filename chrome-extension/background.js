// Voxrate Extension — Background Service Worker (Manifest V3)

// Prevent unhandled rejections from terminating the service worker prematurely
self.addEventListener('unhandledrejection', (e) => {
  console.warn('[Voxrate] Unhandled rejection:', e.reason)
  e.preventDefault()
})

const API_BASE = 'https://voxrate.app/api/extension'
const TOOLKIT_BASE = 'https://voxrate.app/api/toolkit'
const POLL_ALARM = 'voxrate-poll'
const JOB_TIMEOUT_ALARM = 'voxrate-job-timeout'
const POLL_INTERVAL_MINUTES = 1

// ── State ────────────────────────────────────────────────────────
let activeJobTabId = null
let activeJobId    = null
let activeJob      = null
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
  restoreJobState().then(() => poll())
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) poll()
  if (alarm.name === JOB_TIMEOUT_ALARM) handleJobTimeout()
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
    if (!sender.url || !sender.url.startsWith('https://voxrate.app/')) {
      console.warn('[Voxrate] VOXRATE_TOKEN rejected — unexpected sender origin:', sender.url)
      return
    }
    chrome.storage.local.set({ extensionToken: msg.token }, () => {
      console.log('[Voxrate] Token auto-captured from voxrate.app page')
    })
    return
  }

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

  // ENSURE_TAB_ACTIVE removed — force-focusing tabs is a bot detection signal

  // ── Velocity Tracker ─────────────────────────────────────────
  // Buffered to chrome.storage.local (N3: survives service worker termination)
  if (msg.type === 'REVIEW_VELOCITY') {
    chrome.storage.local.get(['extensionToken', 'velocity_active'], ({ extensionToken, velocity_active }) => {
      if (!velocity_active || !extensionToken) return
      const buffer = { type: 'velocity', payload: msg.payload, ts: Date.now() }
      chrome.storage.local.set({ velocity_buffer: buffer }, () => {
        submitVelocity(msg.payload, extensionToken)
      })
    })
    return
  }

  // ── Content Snapshot (for overlay data) ──────────────────────
  if (msg.type === 'CONTENT_SNAPSHOT') {
    chrome.storage.local.get(['extensionToken', 'overlay_active'], ({ extensionToken, overlay_active }) => {
      if (!extensionToken) return
      if (overlay_active) {
        submitSnapshot(msg.payload, extensionToken)
      }
    })
    return
  }

  // ── Competitor Overlay data fetch ─────────────────────────────
  if (msg.type === 'OVERLAY_CHECK') {
    chrome.storage.local.get('extensionToken', ({ extensionToken }) => {
      if (!extensionToken) { sendResponse({ error: 'not_connected' }); return }
      fetchOverlayData(msg.asin, extensionToken).then(sendResponse).catch(() => sendResponse({ error: 'fetch_failed' }))
    })
    return true
  }

  // ── Feature toggles from popup ────────────────────────────────
  if (msg.type === 'SET_FEATURE') {
    const updates = {}
    updates[msg.feature] = msg.enabled
    chrome.storage.local.set(updates, () => sendResponse({ ok: true }))
    // Badge visual feedback
    updateBadge()
    return true
  }

  if (msg.type === 'GET_FEATURES') {
    chrome.storage.local.get(['velocity_active', 'overlay_active'], (result) => {
      sendResponse({
        velocity_active: !!result.velocity_active,
        overlay_active: !!result.overlay_active,
      })
    })
    return true
  }
})

// ── Drain any buffered data on alarm wakeup ───────────────────────
// Handles N3: service worker was killed mid-navigation, data was buffered to storage
async function drainBuffers() {
  const { extensionToken, velocity_buffer, submit_buffer } = await chrome.storage.local.get([
    'extensionToken', 'velocity_buffer', 'submit_buffer',
  ])
  if (!extensionToken) return
  if (velocity_buffer && Date.now() - velocity_buffer.ts < 5 * 60 * 1000) {
    await submitVelocity(velocity_buffer.payload, extensionToken)
    chrome.storage.local.remove('velocity_buffer')
  }
  // Retry buffered job submissions (e.g. SW was killed mid-fetch)
  if (submit_buffer && Date.now() - submit_buffer.ts < 30 * 60 * 1000) {
    const { jobId, reviews, amazonLoggedIn, token, error } = submit_buffer
    chrome.storage.local.remove('submit_buffer')
    await submitJob(jobId, reviews, amazonLoggedIn, token, error)
  }
}

// ── Badge: orange dot when features active ────────────────────────
async function updateBadge() {
  const { velocity_active, overlay_active } = await chrome.storage.local.get(['velocity_active', 'overlay_active'])
  const anyActive = velocity_active || overlay_active
  chrome.action.setBadgeText({ text: anyActive ? '●' : '' })
  chrome.action.setBadgeBackgroundColor({ color: '#f97316' })
}

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
  const stored = await chrome.storage.local.get([
    'extensionToken', 'statsJobsToday', 'statsLastAsin', 'statsLastJobAt', 'statsDate',
    'velocity_active', 'overlay_active', 'voxrate_trial_expired', 'voxrate_cooldown_until',
    'velocity_count_today', 'velocity_date',
  ])
  // Check session storage too — in-memory activeJobTabId is null if SW was restarted mid-job
  const sessionBusy = chrome.storage.session
    ? await chrome.storage.session.get('activeJobTabId').then(s => !!s.activeJobTabId).catch(() => false)
    : false
  const today = new Date().toDateString()
  return {
    connected:          !!stored.extensionToken,
    busy:               activeJobTabId !== null || sessionBusy,
    jobsToday:          stored.statsDate === today ? (stored.statsJobsToday || 0) : 0,
    lastAsin:           stored.statsLastAsin  || null,
    lastJobAt:          stored.statsLastJobAt || null,
    velocity_active:    !!stored.velocity_active,
    overlay_active:     !!stored.overlay_active,
    trial_expired:      !!stored.voxrate_trial_expired,
    cooldown_until:     stored.voxrate_cooldown_until || null,
    velocityToday:      stored.velocity_date === today ? (stored.velocity_count_today || 0) : 0,
  }
}

// ── Poll loop ─────────────────────────────────────────────────────

async function poll() {
  await drainBuffers()
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
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}))
      if (body.error === 'trial_expired') {
        chrome.storage.local.set({ voxrate_trial_expired: true })
      }
      return
    }
    if (!res.ok) return
    chrome.storage.local.remove('voxrate_trial_expired')
    const data = await res.json()
    job = data.job
    chrome.storage.local.remove('voxrate_cooldown_until')
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
  const url = `https://www.${marketplace}/dp/${asin}`

  console.log(`[Voxrate] Starting job ${job.id}: ${asin}`)
  chrome.alarms.create(JOB_TIMEOUT_ALARM, { delayInMinutes: 25 })

  // Open in background — content.js uses ensureVisible() to wait for visibility
  // rather than force-focusing, which is a WAF bot detection signal
  chrome.tabs.create({ url, active: false }, (tab) => {
    const err = chrome.runtime.lastError
    if (err) {
      if (err.message?.includes('Frame')) {
        console.log('[Voxrate] Amazon redirect during tab create — waiting for CONTENT_READY')
      } else {
        console.error('[Voxrate] Could not create tab:', err.message)
        submitJob(job.id, [], false, token, err.message).then(() => cleanupState()).catch(() => cleanupState())
      }
      return
    }
    activeJobTabId = tab.id
    // Persist job state so a restarted SW can recover in-flight jobs
    chrome.storage.session?.set({
      activeJobId: job.id, activeJob: job, activeJobToken: token, activeJobTabId: tab.id,
    }).catch(() => {})
    console.log(`[Voxrate] Tab ${tab.id} opened for ${asin}`)
  })
}

// Restore in-memory state from session storage after SW restart
async function restoreJobState() {
  if (!chrome.storage.session) return
  const saved = await chrome.storage.session.get(['activeJobId', 'activeJob', 'activeJobToken', 'activeJobTabId']).catch(() => ({}))
  if (saved.activeJobId) {
    activeJobId    = saved.activeJobId
    activeJob      = saved.activeJob
    activeJobToken = saved.activeJobToken
    activeJobTabId = saved.activeJobTabId
    console.log(`[Voxrate] Restored job state: ${activeJobId}`)
  }
}

// ── Handlers ─────────────────────────────────────────────────────

// Randomized delay before closing the tab — prevents the instant create→close pattern
// that WAF systems correlate with automation.
function closeTabAfterDelay(tabId) {
  if (!tabId) return
  const delay = 8000 + Math.random() * 22000 // 8-30s
  setTimeout(() => chrome.tabs.remove(tabId).catch(() => {}), delay)
}

async function handleJobTimeout() {
  if (activeJobId === null || !activeJob) return
  const { id: jobId, asin } = activeJob
  const token = activeJobToken
  const tabId = activeJobTabId
  console.warn('[Voxrate] Job hard timeout')
  cleanupState()
  await submitJob(jobId, [], false, token, 'timeout')
  closeTabAfterDelay(tabId)
  stats.jobsToday++
  stats.lastAsin  = asin
  stats.lastJobAt = new Date().toISOString()
  saveStats()
}

async function handleReviewsDone(msg) {
  const { jobId, reviews, amazonLoggedIn, asin } = msg
  if (jobId !== activeJobId) return

  const token = activeJobToken
  const tabId = activeJobTabId
  chrome.alarms.clear(JOB_TIMEOUT_ALARM)
  await submitJob(jobId, reviews, amazonLoggedIn, token, null)
  cleanupState()
  closeTabAfterDelay(tabId)

  stats.jobsToday++
  stats.lastAsin  = asin
  stats.lastJobAt = new Date().toISOString()
  saveStats()
}

async function handleAmazonNotLoggedIn(jobId) {
  if (jobId !== activeJobId) return
  const token = activeJobToken
  const tabId = activeJobTabId
  chrome.alarms.clear(JOB_TIMEOUT_ALARM)
  await submitJob(jobId, [], false, token, 'amazon_not_logged_in')
  cleanupState()
  closeTabAfterDelay(tabId)
}

function cleanupState() {
  chrome.alarms.clear(JOB_TIMEOUT_ALARM)
  activeJobTabId = null
  activeJobId    = null
  activeJob      = null
  activeJobToken = null
  chrome.storage.session?.remove(['activeJobId', 'activeJob', 'activeJobToken', 'activeJobTabId']).catch(() => {})
}

// ── Submit review job ─────────────────────────────────────────────

async function submitJob(jobId, reviews, amazonLoggedIn, token, error) {
  try {
    await fetch(`${API_BASE}/submit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, reviews, amazonLoggedIn, error }),
      keepalive: true,
    })
    console.log(`[Voxrate] Submitted job ${jobId}: ${(reviews || []).length} reviews`)
  } catch (e) {
    console.error('[Voxrate] Submit failed — buffering for retry:', e)
    // Buffer to storage so next poll can retry
    chrome.storage.local.set({
      submit_buffer: { jobId, reviews, amazonLoggedIn, token, error, ts: Date.now() }
    })
  }
}

// ── Submit velocity data ──────────────────────────────────────────

async function submitVelocity(payload, token) {
  try {
    const res = await fetch(`${TOOLKIT_BASE}/velocity`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
    // N6: if plan downgraded, disable velocity tracking
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}))
      if (body.upgradeRequired) {
        chrome.storage.local.set({ velocity_active: false })
        updateBadge()
      }
    }
    if (res.ok) incrementVelocityCount()
    console.log(`[Voxrate] Velocity submitted for ${payload?.asin}`)
  } catch (e) {
    console.error('[Voxrate] Velocity submit failed:', e)
  }
}

async function incrementVelocityCount() {
  const today = new Date().toDateString()
  const { velocity_count_today, velocity_date } = await chrome.storage.local.get(['velocity_count_today', 'velocity_date'])
  const count = velocity_date === today ? (velocity_count_today || 0) : 0
  chrome.storage.local.set({ velocity_count_today: count + 1, velocity_date: today })
}

// ── Submit snapshot data ──────────────────────────────────────────

async function submitSnapshot(payload, token) {
  try {
    await fetch(`${TOOLKIT_BASE}/snapshot`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
    console.log(`[Voxrate] Snapshot submitted for ${payload?.asin}`)
  } catch {}
}

// ── Fetch overlay data ────────────────────────────────────────────

async function fetchOverlayData(asin, token) {
  const res = await fetch(`${TOOLKIT_BASE}/overlay?asin=${encodeURIComponent(asin)}`, {
    headers: { 'Authorization': `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return { error: `status_${res.status}` }
  return res.json()
}
