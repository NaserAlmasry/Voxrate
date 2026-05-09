const SITE = 'https://voxrate.app'

function isEtsyListing(url) {
  return url && url.includes('etsy.com/listing/')
}

function extractListingTitle(tab) {
  // Use the tab title — Etsy tab titles are like "Product Name - Etsy"
  if (tab.title) {
    return tab.title.replace(/\s*[-|]\s*Etsy.*$/i, '').trim().slice(0, 60) || 'Etsy Listing'
  }
  return 'Etsy Listing'
}

function openAnalysis(url, type) {
  const encoded = encodeURIComponent(url)
  const analyzeUrl = `${SITE}/dashboard?url=${encoded}&type=${type}`
  chrome.tabs.create({ url: analyzeUrl })
  window.close()
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0]
    if (!tab || !tab.url) return

    const notEtsyView = document.getElementById('not-etsy-view')
    const etsyView    = document.getElementById('etsy-view')

    if (isEtsyListing(tab.url)) {
      etsyView.style.display = 'block'

      const title   = extractListingTitle(tab)
      const urlText = tab.url.match(/etsy\.com\/listing\/\d+/)?.[0] || tab.url.slice(0, 50)

      document.getElementById('product-title').textContent   = title
      document.getElementById('listing-url-text').textContent = urlText + '...'

      document.getElementById('analyze-btn').addEventListener('click', () => {
        openAnalysis(tab.url, 'own')
      })

      document.getElementById('competitor-btn').addEventListener('click', () => {
        openAnalysis(tab.url, 'competitor')
      })
    } else {
      notEtsyView.style.display = 'block'
    }
  })
})
