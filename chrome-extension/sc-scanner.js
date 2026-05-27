// Voxrate SC Scanner — Content script for Seller Central pages
// Detects the current SC page and extracts relevant data

;(function () {
  'use strict'

  const path = window.location.pathname + window.location.search
  const host = window.location.hostname

  if (!host.includes('sellercentral')) return

  function getText(selector) {
    const el = document.querySelector(selector)
    return el ? el.textContent.trim() : null
  }

  function getNumber(selector) {
    const text = getText(selector)
    if (!text) return null
    const match = text.match(/([\d,.]+)/)
    return match ? parseFloat(match[1].replace(',', '')) : null
  }

  function sendScan(scan_type, data) {
    chrome.runtime.sendMessage({ type: 'SC_DATA', scan_type, data })
  }

  // ── Heartbeat (any SC page) ──────────────────────────────────────
  chrome.runtime.sendMessage({ type: 'SC_DATA', scan_type: 'heartbeat', data: { url: window.location.href } })

  // ── Account Health ────────────────────────────────────────────────
  if (path.includes('/performance/account-health') || path.includes('/account-health')) {
    const waitForPage = () => {
      // ODR
      const odrEl = document.querySelector('[data-test-id="odr-metric-value"], .account-health-metric-value')
      if (!odrEl) {
        setTimeout(waitForPage, 1000)
        return
      }

      const parseRate = (text) => {
        if (!text) return null
        const m = text.match(/([\d.]+)%?/)
        return m ? parseFloat(m[1]) : null
      }

      // Try various selectors for SC health metrics
      const allMetrics = {}
      document.querySelectorAll('[data-test-id], [class*="health-metric"], [class*="account-health"]').forEach(el => {
        const testId = el.getAttribute('data-test-id') || ''
        const text = el.textContent.trim()
        if (testId.includes('odr') || text.includes('Order Defect Rate')) {
          allMetrics.odr_raw = text
        }
        if (testId.includes('late') || text.includes('Late Shipment')) {
          allMetrics.late_shipment_raw = text
        }
        if (testId.includes('cancel') || text.includes('Cancellation Rate')) {
          allMetrics.cancellation_raw = text
        }
      })

      // Extract numbers from metric cards
      const metricCards = document.querySelectorAll('.account-health-card, [class*="metric-card"], [class*="health-card"]')
      const labels = []
      metricCards.forEach(card => {
        const label = card.querySelector('[class*="label"], h3, h4, strong')
        const value = card.querySelector('[class*="value"], [class*="rate"], .a-size-large')
        if (label && value) {
          labels.push({ label: label.textContent.trim(), value: value.textContent.trim() })
        }
      })

      // Best-effort extraction
      let odr = null, lateShipment = null, cancellation = null, policyViolations = 0
      labels.forEach(({ label, value }) => {
        const l = label.toLowerCase()
        if (l.includes('order defect')) odr = parseRate(value)
        if (l.includes('late shipment')) lateShipment = parseRate(value)
        if (l.includes('cancel')) cancellation = parseRate(value)
        if (l.includes('policy violation')) {
          const m = value.match(/(\d+)/)
          if (m) policyViolations = parseInt(m[1], 10)
        }
      })

      // Fallback: look for specific elements Amazon uses
      const odrSpecific = document.querySelector('[data-test-id="odr-metric-value"]')
      if (odrSpecific) odr = parseRate(odrSpecific.textContent)

      sendScan('account_health', {
        odr,
        late_shipment_rate: lateShipment,
        cancellation_rate: cancellation,
        policy_violations: policyViolations,
        raw_labels: labels,
        captured_at: new Date().toISOString(),
      })
    }
    setTimeout(waitForPage, 2000)
  }

  // ── Stranded Inventory ────────────────────────────────────────────
  if (path.includes('STRANDED_INVENTORY') || path.includes('stranded') || (path.includes('inventory') && path.includes('stranded'))) {
    const waitForPage = () => {
      const table = document.querySelector('[id*="stranded"], table[class*="stranded"]')
      if (!table && document.querySelectorAll('tr').length < 3) {
        setTimeout(waitForPage, 1500)
        return
      }

      const rows = document.querySelectorAll('tr')
      let strandedUnits = 0
      const strandedAsins = []

      rows.forEach(row => {
        const cells = row.querySelectorAll('td')
        if (cells.length < 2) return
        const asinCell = row.querySelector('[data-column="asin"], td:first-child')
        const unitsCell = row.querySelector('[data-column="units"], td:nth-child(3)')
        if (asinCell && unitsCell) {
          const asinMatch = asinCell.textContent.match(/[A-Z0-9]{10}/)
          const unitsMatch = unitsCell.textContent.match(/(\d+)/)
          if (asinMatch && unitsMatch) {
            strandedAsins.push({ asin: asinMatch[0], units: parseInt(unitsMatch[1], 10) })
            strandedUnits += parseInt(unitsMatch[1], 10)
          }
        }
      })

      // Look for total count in page header
      const totalEl = document.querySelector('[class*="total-count"], [class*="stranded-count"]')
      if (totalEl) {
        const m = totalEl.textContent.match(/(\d+)/)
        if (m) strandedUnits = Math.max(strandedUnits, parseInt(m[1], 10))
      }

      // Estimate daily cost at $0.015/unit/day (approximate FBA storage)
      const dailyCost = Math.round(strandedUnits * 0.015 * 100) / 100

      sendScan('stranded_inventory', {
        stranded_units: strandedUnits,
        stranded_asins: strandedAsins.slice(0, 20),
        daily_cost: dailyCost,
        captured_at: new Date().toISOString(),
      })
    }
    setTimeout(waitForPage, 2000)
  }

  // ── Reimbursements ─────────────────────────────────────────────────
  if (path.includes('reimbursements') || (path.includes('reportcentral') && path.includes('reimbursement'))) {
    const waitForPage = () => {
      const rows = document.querySelectorAll('tr[class*="data"], tbody tr')
      if (rows.length === 0) {
        setTimeout(waitForPage, 1500)
        return
      }

      const reimbursements = []
      let totalAmount = 0

      rows.forEach(row => {
        const cells = row.querySelectorAll('td')
        if (cells.length < 3) return
        const text = Array.from(cells).map(c => c.textContent.trim())
        const amountMatch = text.join(' ').match(/\$([\d,.]+)/)
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1].replace(',', ''))
          totalAmount += amount
          reimbursements.push({ row: text.join(' | '), amount })
        }
      })

      sendScan('reimbursements', {
        count: reimbursements.length,
        total_amount: Math.round(totalAmount * 100) / 100,
        items: reimbursements.slice(0, 50),
        captured_at: new Date().toISOString(),
      })
    }
    setTimeout(waitForPage, 2000)
  }

  // ── Returns ───────────────────────────────────────────────────────
  if (path.includes('/returns') || path.includes('returnReport')) {
    const waitForPage = () => {
      const rows = document.querySelectorAll('tr[class*="data"], tbody tr')
      if (rows.length === 0) {
        setTimeout(waitForPage, 1500)
        return
      }

      const returnReasons = {}
      rows.forEach(row => {
        const reasonEl = row.querySelector('[data-column="return-reason"], td:nth-child(5), td:nth-child(4)')
        if (reasonEl) {
          const reason = reasonEl.textContent.trim()
          if (reason && reason.length > 2) {
            returnReasons[reason] = (returnReasons[reason] || 0) + 1
          }
        }
      })

      const sortedReasons = Object.entries(returnReasons)
        .sort(([, a], [, b]) => b - a)
        .map(([reason, count]) => ({ reason, count }))

      sendScan('returns', {
        total_returns: rows.length,
        reasons: sortedReasons,
        captured_at: new Date().toISOString(),
      })
    }
    setTimeout(waitForPage, 2000)
  }
})()
