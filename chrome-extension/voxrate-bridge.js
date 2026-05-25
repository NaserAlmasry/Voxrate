// Voxrate Extension — Bridge Content Script
// Runs on voxrate.app pages. Captures the user's extension token
// so the popup doesn't need manual copy-paste.

// Listen for the page to broadcast the token via window.postMessage
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://voxrate.app') return
  if (event.data?.type !== 'VOXRATE_EXTENSION_TOKEN') return
  const token = event.data.token
  if (!token || typeof token !== 'string') return
  chrome.runtime.sendMessage({ type: 'VOXRATE_TOKEN', token })
})

// Tell the page the extension is installed (version handshake)
window.postMessage({ type: 'VOXRATE_EXTENSION_INSTALLED', version: '1.0.0' }, '*')
