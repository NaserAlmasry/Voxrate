// Voxrate — Visibility Spoofer (runs in MAIN world at document_start)
// Overrides Page Visibility API so Amazon's JS always sees an active tab.
// Without this, Amazon detects document.visibilityState === 'hidden' and
// returns the same cached reviews for every pageNumber > 2.
;(() => {
  try {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: false })
    Object.defineProperty(document, 'hidden',          { get: () => false,     configurable: false })
    document.hasFocus = () => true
    // Swallow visibilitychange events before page scripts see them
    document.addEventListener('visibilitychange', (e) => { e.stopImmediatePropagation() }, true)
  } catch { /* already defined non-configurable — ignore */ }
})()
