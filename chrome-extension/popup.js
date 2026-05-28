// Voxrate Extension — Popup Script

const $ = (id) => document.getElementById(id)

async function init() {
  const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' })

  if (!status.connected) {
    $('setup-view').style.display = 'block'
    $('main-view').style.display = 'none'
    $('trial-expired-view').style.display = 'none'
    return
  }

  // Check if trial expired
  const { voxrate_trial_expired } = await chrome.storage.local.get('voxrate_trial_expired')
  if (voxrate_trial_expired) {
    $('setup-view').style.display = 'none'
    $('main-view').style.display = 'none'
    $('trial-expired-view').style.display = 'block'
    return
  }

  $('setup-view').style.display = 'none'
  $('main-view').style.display = 'block'
  $('trial-expired-view').style.display = 'none'

  $('jobs-today').textContent = status.jobsToday

  // Show cooldown if active
  const { voxrate_cooldown_until } = await chrome.storage.local.get('voxrate_cooldown_until')
  const cooldownLeft = voxrate_cooldown_until ? Math.max(0, voxrate_cooldown_until - Date.now()) : 0
  if (cooldownLeft > 0 && !status.busy) {
    const mins = Math.ceil(cooldownLeft / 60000)
    $('busy-row').style.display = 'flex'
    $('busy-row').querySelector('span').textContent = `Next analysis ready in ~${mins} min`
  } else {
    $('busy-row').style.display = status.busy ? 'flex' : 'none'
  }

  if (status.lastAsin) {
    $('last-asin').textContent = status.lastAsin
    $('last-asin').classList.remove('muted')
  }

  // Amazon login check — try to fetch amazon.com silently
  checkAmazonLogin()
}

async function checkAmazonLogin() {
  try {
    const res = await fetch('https://www.amazon.com/gp/css/homepage.html', {
      credentials: 'include',
      redirect: 'manual',
    })
    // If we get a redirect to sign-in, not logged in
    const loggedIn = res.type !== 'opaqueredirect' && res.status < 400
    if (!loggedIn) {
      $('amazon-dot').className = 'dot amber'
      $('amazon-label').textContent = 'Please log into Amazon'
    }
  } catch (e) {
    // Can't determine — assume ok
  }
}

$('connect-btn')?.addEventListener('click', async () => {
  const token = $('token-input').value.trim()
  if (!token) return

  $('token-error').style.display = 'none'

  const res = await chrome.runtime.sendMessage({ type: 'SET_TOKEN', token })
  if (res?.ok) {
    init()
  } else {
    $('token-error').style.display = 'block'
  }
})

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

// Token input: connect on Enter
$('token-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('connect-btn').click()
})

init()
