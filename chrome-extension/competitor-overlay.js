// Voxrate Competitor Overlay — Shadow DOM panel on Amazon product pages
// Uses Shadow DOM (closed mode) so Amazon's JS cannot detect or interfere.
// Only renders when overlay_active is set by user in popup.

;(function () {
  'use strict'

  const url = window.location.href
  const asinMatch = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
  if (!asinMatch) return
  const asin = asinMatch[1].toUpperCase()

  let shadowHost = null

  chrome.storage.local.get('overlay_active', ({ overlay_active }) => {
    if (overlay_active) initOverlay()
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !('overlay_active' in changes)) return
    if (changes.overlay_active.newValue) {
      initOverlay()
    } else {
      removeOverlay()
    }
  })

  function removeOverlay() {
    if (shadowHost) { shadowHost.remove(); shadowHost = null }
  }

  function initOverlay() {
    if (shadowHost) return

    // Shadow host — use random ID to avoid extension fingerprinting via document.getElementById
    shadowHost = document.createElement('div')
    shadowHost.id = 'vx-' + Math.random().toString(36).slice(2, 10)
    shadowHost.style.cssText = 'position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:2147483647;'
    document.body.appendChild(shadowHost)

    // Closed shadow DOM — Amazon's JS cannot query inside
    const shadow = shadowHost.attachShadow({ mode: 'closed' })

    // Inject styles into shadow root (isolated from page CSS)
    const style = document.createElement('style')
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      #panel {
        width: 270px;
        background: #fff;
        border-left: 3px solid #f97316;
        border-radius: 10px 0 0 10px;
        box-shadow: -4px 0 20px rgba(0,0,0,0.14);
        font-size: 12px;
        overflow: hidden;
      }
      #header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 9px 12px;
        background: #f97316;
        cursor: pointer; user-select: none;
      }
      #header-title { color: #fff; font-weight: 700; font-size: 12px; }
      #toggle-btn   { color: #fff; font-size: 16px; line-height: 1; background: none; border: none; cursor: pointer; }
      #body {
        padding: 10px 12px;
        max-height: 320px;
        overflow-y: auto;
        color: #374151;
      }
      .loading { color: #9ca3af; text-align: center; padding: 16px 0; font-size: 12px; }
      .alert-box {
        background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;
        padding: 7px 9px; margin-bottom: 8px;
      }
      .alert-title { color: #dc2626; font-weight: 700; font-size: 11px; margin-bottom: 3px; }
      .alert-item  { color: #b91c1c; font-size: 10px; margin: 1px 0; }
      .section-title {
        color: #374151; font-weight: 700; font-size: 10px;
        text-transform: uppercase; letter-spacing: .06em;
        margin: 8px 0 4px;
      }
      .row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; color: #4b5563; }
      .row strong { color: #111827; }
      .row.dim     { color: #9ca3af; }
      .bar-wrap { display: flex; align-items: flex-end; gap: 2px; height: 36px; margin-top: 4px; }
      .bar { flex: 1; border-radius: 2px 2px 0 0; transition: opacity .15s; }
      .bar:hover { opacity: .8; }
      .date-row { color: #9ca3af; font-size: 9px; margin-top: 2px; }
      .footer-link { border-top: 1px solid #f3f4f6; padding: 7px 0 0; margin-top: 8px; }
      .footer-link a { color: #f97316; font-size: 10px; font-weight: 700; text-decoration: none; }
      .empty { color: #9ca3af; text-align: center; padding: 16px 0; font-size: 11px; line-height: 1.5; }
    `

    const panel = document.createElement('div')
    panel.id = 'panel'

    const header = document.createElement('div')
    header.id = 'header'
    header.innerHTML = `
      <span id="header-title">Voxrate · ${asin}</span>
      <button id="toggle-btn">−</button>
    `

    const body = document.createElement('div')
    body.id = 'body'
    body.innerHTML = '<div class="loading">Loading…</div>'

    panel.appendChild(header)
    panel.appendChild(body)
    shadow.appendChild(style)
    shadow.appendChild(panel)

    let collapsed = false
    header.addEventListener('click', () => {
      collapsed = !collapsed
      body.style.display = collapsed ? 'none' : 'block'
      shadow.getElementById('toggle-btn').textContent = collapsed ? '+' : '−'
    })

    // Fetch data from background
    chrome.runtime.sendMessage({ type: 'OVERLAY_CHECK', asin }, (response) => {
      if (chrome.runtime.lastError || !response || response.error) {
        body.innerHTML = '<div class="empty">Could not load data.<br>Make sure you\'re logged into Voxrate.</div>'
        return
      }
      if (response.is_own) {
        body.innerHTML = `<div class="empty" style="padding:14px 0;">
          <div style="font-size:18px;margin-bottom:6px;">🏠</div>
          <strong style="color:#111827;font-size:12px;">This is your listing</strong><br>
          <a href="https://voxrate.app/dashboard" target="_blank" style="color:#f97316;font-size:11px;font-weight:700;text-decoration:none;">View in dashboard →</a>
        </div>`
        return
      }
      renderData(body, response)
    })
  }

  function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  }

  function renderData(container, data) {
    const { snapshot, velocity, alerts } = data
    let html = ''

    if (alerts && alerts.length > 0) {
      html += `<div class="alert-box">
        <div class="alert-title">⚠ ${alerts.length} Alert${alerts.length > 1 ? 's' : ''}</div>
        ${alerts.slice(0, 2).map(a => `<div class="alert-item">${esc(a.title)}</div>`).join('')}
      </div>`
    }

    if (snapshot) {
      html += `<div class="section-title">Snapshot</div>`
      if (snapshot.title) {
        const raw = String(snapshot.title)
        html += `<div class="row" style="font-size:11px;color:#111827;margin-bottom:4px;">${esc(raw.slice(0, 55))}${raw.length > 55 ? '…' : ''}</div>`
      }
      if (snapshot.price != null) html += `<div class="row"><span>Price</span><strong>$${Number(snapshot.price).toFixed(2)}</strong></div>`
      if (snapshot.review_count != null) html += `<div class="row"><span>Reviews</span><strong>${Number(snapshot.review_count).toLocaleString()} (${esc(snapshot.average_rating ?? '?')} ★)</strong></div>`
      if (snapshot.buy_box_seller) html += `<div class="row"><span>Buy Box</span><strong>${esc(snapshot.buy_box_seller).slice(0, 20)}</strong></div>`
      html += `<div class="row dim"><span>Captured</span><span>${new Date(snapshot.captured_at).toLocaleDateString()}</span></div>`
    }

    if (velocity && velocity.length > 0) {
      const recent = velocity.slice(-7)
      const maxVal = Math.max(...recent.map(v => v.one_star), 1)
      html += `<div class="section-title" style="margin-top:10px;">1-Star Velocity (7d)</div>
        <div class="bar-wrap">
          ${recent.map(v => {
            const h = Math.max(3, Math.round((v.one_star / maxVal) * 32))
            const color = v.one_star >= 5 ? '#ef4444' : v.one_star >= 2 ? '#f97316' : '#d1d5db'
            return `<div class="bar" style="height:${h}px;background:${color};" title="${v.date}: ${v.one_star} one-stars"></div>`
          }).join('')}
        </div>
        <div class="date-row">${recent[0]?.date} → ${recent[recent.length - 1]?.date}</div>`
    }

    if (!snapshot && (!alerts || alerts.length === 0)) {
      html = `<div class="empty">No data yet for this ASIN.<br>Visit the listing to capture a snapshot.</div>`
    }

    html += `<div class="footer-link"><a href="https://voxrate.app/dashboard/toolkit" target="_blank">Open Toolkit →</a></div>`
    container.innerHTML = html
  }
})()
