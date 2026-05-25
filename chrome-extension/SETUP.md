# Voxrate Chrome Extension — Setup Guide

## 1. Generate Icons

```bash
cd chrome-extension/icons
# Install ImageMagick or Inkscape, then:
magick icon.svg -resize 16x16 icon16.png
magick icon.svg -resize 48x48 icon48.png
magick icon.svg -resize 128x128 icon128.png
```

## 2. Run the Database Migration

In Supabase SQL editor (or via CLI):

```bash
supabase db push
# or manually run:
# supabase/migrations/20260525_extension_jobs.sql
```

## 3. Load the Extension in Chrome (Dev/Test)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder
5. The Voxrate extension appears in the toolbar

## 4. Connect the Extension to Voxrate

### Automatic (recommended):
1. Open `https://voxrate.app/settings/extension` while extension is installed
2. The page calls `POST /api/extension/token` and broadcasts the token via `window.postMessage`
3. The extension's bridge script (`voxrate-bridge.js`) catches it and stores it automatically
4. Popup shows "Connected" immediately

### Manual fallback:
1. Go to `https://voxrate.app/settings/extension` → copy your token
2. Click the extension icon → paste token → click Connect

## 5. What Sellers See During Onboarding

When a seller first installs Voxrate:

1. **Dashboard shows a banner**: "Install the Voxrate Chrome Extension to enable unlimited review scraping"
2. Clicking the banner opens Chrome Web Store install page
3. After install: seller visits `voxrate.app/settings/extension` — token auto-captured
4. Popup shows green "Connected" dot
5. Next time they analyze a product, the extension silently opens a hidden tab, scrapes reviews, and closes it — typically in 10-30 seconds for 150 reviews
6. If Amazon isn't logged in: Voxrate shows "Please log into Amazon in your browser and try again"

## 6. Package for Chrome Web Store

```bash
# Zip the chrome-extension/ folder (icons must be generated first):
cd chrome-extension
zip -r voxrate-extension.zip . --exclude "*.md" --exclude ".DS_Store"
```

Upload `voxrate-extension.zip` at: https://chrome.google.com/webstore/devconsole

Required for submission:
- 3 screenshots (1280×800 or 640×400)
- 128×128 icon
- Privacy policy URL (voxrate.app/privacy)
- Single purpose description: "Scrapes Amazon review text for your Voxrate account to enable AI analysis"

## 7. Backend Environment

No new env vars needed — the extension API routes use existing `SUPABASE_SERVICE_ROLE_KEY`.

## 8. Error States

| Condition | Extension signals | Voxrate shows |
|-----------|------------------|---------------|
| Extension not installed | — | "Install the Chrome extension to analyze this product" |
| Extension installed, no heartbeat in 30s | — | Falls back to Railway/Canopy |
| Amazon not logged in | `amazon_not_logged_in` status | "Please log into Amazon in your browser and try again" |
| Scrape timeout (>90s) | `partial` status with whatever reviews collected | Uses partial results |
| Extension offline mid-job | job marked failed after 2min | Falls back to Railway/Canopy |
