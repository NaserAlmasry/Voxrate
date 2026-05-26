// Ensures Amazon page scripts load correctly in background tabs.
// Amazon defers review content when visibilityState is 'hidden',
// causing pagination to return stale data. This keeps the page
// API state consistent so all review pages load completely.
;(() => {
  try {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: false })
    Object.defineProperty(document, 'hidden',          { get: () => false,     configurable: false })
    document.hasFocus = () => true
    document.addEventListener('visibilitychange', (e) => { e.stopImmediatePropagation() }, true)
  } catch { /* already defined — ignore */ }
})()
