// Voxrate Extension — Popup Script

const $ = (id) => document.getElementById(id)

async function init() {
  const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' })

  if (!status.connected) {
    show('setup-view')
    return
  }

  if (status.trial_expired) {
    show('trial-expired-view')
    return
  }

  show('main-view')
  renderMain(status)
}

function show(viewId) {
  for (const id of ['setup-view', 'trial-expired-view', 'main-view']) {
    const el = $(id)
    if (el) el.style.display = id === viewId ? 'block' : 'none'
  }
}

function renderMain(status) {
  // Stats
  $('jobs-today').textContent = status.jobsToday || 0
  $('velocity-today').textContent = status.velocityToday || 0
  $('last-asin-num').textContent = status.lastAsin || '—'

  // Busy indicator
  const busy = status.busy
  const cooldownLeft = status.cooldown_until ? Math.max(0, status.cooldown_until - Date.now()) : 0
  if (busy || cooldownLeft > 0) {
    $('busy-row').style.display = 'flex'
    $('busy-label').textContent = busy
      ? 'Scraping reviews…'
      : `Next analysis ready in ~${Math.ceil(cooldownLeft / 60000)} min`
  }

  // Feature toggles
  renderToggle('velocity_active', status.velocity_active, 'velocity-toggle', 'velocity-note',
    'On — reading velocity on product visits',
    'Off — toggle to enable')

  renderToggle('overlay_active', status.overlay_active, 'overlay-toggle', 'overlay-note',
    'On — overlay shown on competitor pages',
    'Off — toggle to enable')

  // Account Health connect button
  updateHealthButton()
}

function renderToggle(feature, isOn, toggleId, noteId, onText, offText) {
  const btn = $(toggleId)
  if (!btn) return
  btn.className = `toggle${isOn ? ' on' : ''}`
  const note = $(noteId)
  if (note) {
    note.textContent = isOn ? onText : offText
    note.className = `feature-note${isOn ? ' ok' : ''}`
  }

  btn.onclick = async () => {
    const current = btn.classList.contains('on')
    const next = !current
    btn.className = `toggle${next ? ' on' : ''}`
    if (note) {
      note.textContent = next ? onText : offText
      note.className = `feature-note${next ? ' ok' : ''}`
    }
    await chrome.runtime.sendMessage({ type: 'SET_FEATURE', feature, enabled: next })
  }
}

async function updateHealthButton() {
  const { amazon_sp_connected } = await chrome.storage.local.get('amazon_sp_connected')
  const btn = $('health-connect-btn')
  const note = $('health-note')
  if (!btn) return

  if (amazon_sp_connected) {
    btn.textContent = 'Connected ✓'
    btn.className = 'btn-connect connected'
    if (note) { note.textContent = '● Syncing every 6 hours'; note.className = 'feature-note ok' }
    btn.onclick = null
  } else {
    btn.textContent = 'Connect'
    btn.className = 'btn-connect'
    if (note) { note.textContent = 'Connect Amazon account to enable'; note.className = 'feature-note' }
    btn.onclick = () => {
      chrome.tabs.create({ url: 'https://voxrate.app/api/amazon/connect' })
    }
  }
}

// ── Setup view events ─────────────────────────────────────────────

$('connect-btn')?.addEventListener('click', async () => {
  const token = $('token-input')?.value.trim()
  if (!token) return
  $('token-error').style.display = 'none'
  const res = await chrome.runtime.sendMessage({ type: 'SET_TOKEN', token })
  if (res?.ok) { init() } else { $('token-error').style.display = 'block' }
})

$('token-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('connect-btn')?.click()
})

// ── Disconnect ────────────────────────────────────────────────────

$('disconnect-btn')?.addEventListener('click', () => {
  $('disconnect-modal').classList.add('visible')
})

$('cancel-disconnect')?.addEventListener('click', () => {
  $('disconnect-modal').classList.remove('visible')
})

$('confirm-disconnect')?.addEventListener('click', async () => {
  $('disconnect-modal').classList.remove('visible')
  await chrome.runtime.sendMessage({ type: 'CLEAR_TOKEN' })
  init()
})

// ── Check if Amazon SP-API connected (from storage set by callback) ──
// voxrate.app/api/amazon/callback sets amazon_sp_connected=true in
// chrome.storage.local via the voxrate-bridge.js postMessage channel
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'amazon_sp_connected' in changes) {
    updateHealthButton()
  }
})

init()
