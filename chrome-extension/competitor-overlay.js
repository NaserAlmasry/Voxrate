// Voxrate Competitor Overlay — Content script on Amazon product pages
// Shows a collapsible analysis panel if overlay is enabled

;(function () {
  'use strict'

  const url = window.location.href
  const asinMatch = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
  if (!asinMatch) return

  const asin = asinMatch[1].toUpperCase()

  // Use chrome.storage.local (works cross-origin; localStorage only works same-origin)
  chrome.storage.local.get('voxrate_overlay_enabled', ({ voxrate_overlay_enabled }) => {
    if (voxrate_overlay_enabled) initOverlay()
  })

  // React to toggle changes made from any page (dashboard, popup, etc.)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !('voxrate_overlay_enabled' in changes)) return
    if (changes.voxrate_overlay_enabled.newValue) {
      initOverlay()
    } else {
      removeOverlay()
    }
  })

  function removeOverlay() {
    const existing = document.getElementById('voxrate-overlay-panel')
    if (existing) existing.remove()
  }

  function initOverlay() {
    if (document.getElementById('voxrate-overlay-panel')) return

    const panel = document.createElement('div')
    panel.id = 'voxrate-overlay-panel'
    panel.style.cssText = `
      position: fixed;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      z-index: 99999;
      width: 280px;
      background: white;
      border-left: 3px solid #f97316;
      border-radius: 12px 0 0 12px;
      box-shadow: -4px 0 20px rgba(0,0,0,0.12);
      font-family: 'DM Sans', -apple-system, sans-serif;
      font-size: 13px;
      transition: transform 0.3s ease;
    `

    const header = document.createElement('div')
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: #f97316;
      border-radius: 9px 0 0 0;
      cursor: pointer;
      user-select: none;
    `
    header.innerHTML = `
      <span style="color:white;font-weight:600;font-size:13px;">Voxrate · ${asin}</span>
      <span id="voxrate-toggle" style="color:white;font-size:18px;line-height:1;">−</span>
    `

    const body = document.createElement('div')
    body.id = 'voxrate-overlay-body'
    body.style.cssText = 'padding: 12px 14px; max-height: 340px; overflow-y: auto;'
    body.innerHTML = '<p style="color:#6b7280;text-align:center;padding:20px 0;">Loading...</p>'

    panel.appendChild(header)
    panel.appendChild(body)
    document.body.appendChild(panel)

    let collapsed = false
    header.addEventListener('click', () => {
      collapsed = !collapsed
      body.style.display = collapsed ? 'none' : 'block'
      document.getElementById('voxrate-toggle').textContent = collapsed ? '+' : '−'
    })

    chrome.runtime.sendMessage({ type: 'OVERLAY_CHECK', asin }, (response) => {
      if (!response || response.error) {
        body.innerHTML = '<p style="color:#ef4444;font-size:12px;padding:8px 0;">Could not load data. Make sure you\'re logged into Voxrate.</p>'
        return
      }
      renderOverlayData(body, response)
    })
  }

  function renderOverlayData(container, data) {
    const { snapshot, velocity, alerts } = data

    let html = ''

    if (alerts && alerts.length > 0) {
      html += `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;margin-bottom:10px;">
        <p style="color:#dc2626;font-weight:600;margin:0 0 4px;">⚠ ${alerts.length} Alert${alerts.length > 1 ? 's' : ''}</p>
        ${alerts.slice(0, 2).map(a => `<p style="color:#b91c1c;font-size:11px;margin:2px 0;">${a.title}</p>`).join('')}
      </div>`
    }

    if (snapshot) {
      html += `<div style="margin-bottom:10px;">
        <p style="color:#374151;font-weight:600;margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Last Snapshot</p>
        ${snapshot.title ? `<p style="color:#111827;margin:2px 0;font-size:12px;">${snapshot.title.slice(0, 60)}${snapshot.title.length > 60 ? '...' : ''}</p>` : ''}
        ${snapshot.price != null ? `<p style="color:#374151;margin:2px 0;font-size:12px;">Price: <strong>$${snapshot.price}</strong></p>` : ''}
        ${snapshot.review_count != null ? `<p style="color:#374151;margin:2px 0;font-size:12px;">Reviews: <strong>${snapshot.review_count.toLocaleString()}</strong> (${snapshot.average_rating ?? '?'} ★)</p>` : ''}
        ${snapshot.buy_box_seller ? `<p style="color:#374151;margin:2px 0;font-size:12px;">Buy Box: <strong>${snapshot.buy_box_seller.slice(0, 25)}</strong></p>` : ''}
        <p style="color:#9ca3af;font-size:10px;margin:4px 0 0;">${new Date(snapshot.captured_at).toLocaleDateString()}</p>
      </div>`
    }

    if (velocity && velocity.length > 0) {
      const recent = velocity.slice(-7)
      const maxVal = Math.max(...recent.map(v => v.one_star), 1)
      html += `<div>
        <p style="color:#374151;font-weight:600;margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">1-Star Velocity (7d)</p>
        <div style="display:flex;align-items:flex-end;gap:3px;height:40px;">
          ${recent.map(v => {
            const h = Math.max(4, Math.round((v.one_star / maxVal) * 36))
            const color = v.one_star >= 5 ? '#ef4444' : v.one_star >= 2 ? '#f97316' : '#d1d5db'
            return `<div style="flex:1;background:${color};height:${h}px;border-radius:2px 2px 0 0;" title="${v.date}: ${v.one_star} one-stars"></div>`
          }).join('')}
        </div>
        <p style="color:#9ca3af;font-size:10px;margin:3px 0 0;">${recent[0]?.date} → ${recent[recent.length - 1]?.date}</p>
      </div>`
    }

    if (!snapshot && (!alerts || alerts.length === 0)) {
      html = `<p style="color:#6b7280;font-size:12px;text-align:center;padding:12px 0;">No data yet for this ASIN.<br>Browse the listing to capture a snapshot.</p>`
    }

    container.innerHTML = html

    const footer = document.createElement('div')
    footer.style.cssText = 'border-top:1px solid #f3f4f6;padding:8px 0 0;margin-top:8px;'
    footer.innerHTML = `<a href="https://voxrate.app/dashboard/toolkit" target="_blank" style="color:#f97316;font-size:11px;text-decoration:none;font-weight:600;">Open Toolkit →</a>`
    container.appendChild(footer)
  }
})()
