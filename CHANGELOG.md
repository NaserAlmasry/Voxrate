# Changelog

---

## May 2026

### Features
- **Sentiment Alerts** — scheduled 1★/2★ review scans (Growth/Pro plans). Replaces "coming soon" placeholder on landing page.
- **Scraper improvements** — cache-first reads, dedup, 2★ budget filtering, verified-review preference, recency weighting, dynamic skip logic (6 improvements in one release).
- **Analyze button** — prominent shortcut added to top of sidebar nav.
- **Blog** — ISR revalidation reduced to 60s. New posts now appear within a minute of publishing.
- **Referral program** — referral code generation, claim flow, and conversion tracking on first paid checkout.
- **Shareable reports** — public share token per report (`/report/[id]`).
- **Compare** — side-by-side report comparison tool.
- **Watchlist sparklines** — score history chart via `watchlist_history` table.
- **CSV bulk analysis** — async pipeline via Upstash QStash worker.
- **Shop Health** — aggregates scores across all analyzed listings, surfaces weakest/strongest.

### Fixes
- Blog index page: switched to plain Supabase client (cookie client fails in ISR context).
- Auth callback: `pendingPlan`/`pendingPack` params now survive the OAuth round-trip correctly.
- Stripe webhook: `pack_credits` now preserved on subscription renewal and downgrade.

### Infrastructure
- Migrated from Etsy to **Amazon** as the primary platform.
- LLM stack: Anthropic removed; active chain is Mistral Large → Groq Llama 3.3 70B → Mistral Large 2411.
- Scraper stack: Canopy (×5 rotating keys) → ScrapingDog → ScraperAPI → Rainforest fallback chain.
- 7-day per-ASIN review cache (`asin_review_cache`) to control scraping costs.
- Vercel crons: monitor (08:00 UTC), digest (Monday 09:00 UTC), sentiment-digest (10:00 UTC).
- Prompt injection hardening: XML sanitization, Cyrillic homoglyph normalization, review-text scrubbing.
- CSRF protection on all POST routes (X-Requested-With + Origin/Referer host match).
- Timing-safe HMAC + 5-min replay window on internal cron endpoints.
