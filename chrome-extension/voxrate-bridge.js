// Voxrate Extension — Bridge Content Script
// Runs on voxrate.app pages. Captures the user's extension token
// so the popup doesn't need manual copy-paste.

window.addEventListener('message', (event) => {
  if (event.origin !== 'https://voxrate.app') return
  if (event.source !== window) return

  if (event.data?.type === 'VOXRATE_EXTENSION_TOKEN') {
    const token = event.data.token
    if (!token || typeof token !== 'string') return
    chrome.runtime.sendMessage({ type: 'VOXRATE_TOKEN', token })
  }

  if (event.data?.type === 'VOXRATE_OVERLAY_TOGGLE') {
    chrome.storage.local.set({ voxrate_overlay_enabled: !!event.data.enabled })
  }
})

// Tell the page the extension is installed (version handshake)
window.postMessage({ type: 'VOXRATE_EXTENSION_INSTALLED', version: '1.1.0' }, 'https://voxrate.app')
