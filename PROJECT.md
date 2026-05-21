# Voxrate — Project Overview

## What is Voxrate?

Voxrate is an AI-powered Amazon review analysis SaaS for Amazon sellers. Paste any Amazon product URL or ASIN and get a full health report — complaints, strengths, quick wins, SEO keywords, listing grade, and actionable fixes. Sellers use it to improve listings and increase sales without manually reading hundreds of reviews.

**Live URL:** https://voxrate.app

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | Supabase Auth (Google OAuth + Email) |
| Database | Supabase (PostgreSQL + RLS) |
| AI (primary) | Mistral Large Latest → Groq Llama 3.3 70B → Mistral Large 2411 (fallback chain) |
| Scraping | Canopy (×5 rotating keys) → ScrapingDog → ScraperAPI → Rainforest (fallback chain) |
| Async jobs | Upstash QStash (CSV analysis worker) |
| Rate limiting | Upstash Redis |
| Payments | Stripe (subscriptions + one-time credit packs) |
| Email | Resend |
| Observability | Sentry + Vercel Analytics |
| Hosting | Vercel (auto-deploy on push to main) |
| Domain | voxrate.app (Cloudflare DNS) |

---

## Credit System

All costs are defined in `app/lib/credit-costs.ts` — single source of truth.

| Action | Credits |
|--------|---------|
| Own listing analysis | 20 cr |
| Competitor analysis | 35 cr |
| Sentiment alert (daily) | 15 cr/run |
| Sentiment alert (every other day) | 12 cr/run |
| Sentiment alert (weekly) | 10 cr/run |
| Sentiment alert (bi-weekly) | 5 cr/run |

### Plans

| Plan | Price | Credits/month |
|------|-------|--------------|
| Free | $0 | 20 (1 analysis) |
| Starter | $9.99/mo | 300 |
| Growth | $24.99/mo | 800 |
| Pro | $49.99/mo | 2,000 |

### Credit Packs (one-time, never expire)

| Pack | Credits |
|------|---------|
| Starter pack | 100 cr |
| Growth pack | 300 cr |
| Pro pack | 700 cr |

---

## Core Features

| Feature | Plans |
|---------|-------|
| Review Analyzer (URL or ASIN) | All |
| CSV Bulk Analysis | All |
| Listing Grader (A–F) | All |
| AI Rewriter | All |
| Reply Generator | All |
| Listing Builder | All (free: 1 use total) |
| Shop Health Dashboard | All |
| Watchlist | All |
| Competitor Analysis | Starter+ |
| Sentiment Alerts | Growth+ |
| Review Monitor | Pro |
| Shareable Reports | All |
| Referral Program | All |

---

## Project Structure

```
voxrate/
├── app/
│   ├── api/                    # All backend API routes
│   │   ├── analyze/            # Core Amazon review analysis pipeline
│   │   ├── analyze-section/    # Re-analyze individual report sections
│   │   ├── analyze-csv/        # Bulk CSV submission → QStash queue
│   │   ├── jobs/csv-worker/    # QStash worker that processes CSV jobs
│   │   ├── grade/              # A–F listing grader
│   │   ├── rewrite/            # AI description rewriter
│   │   ├── reply/              # Review reply generator
│   │   ├── listing-builder/    # Full listing generator
│   │   ├── shop-health/        # Shop-wide health aggregation
│   │   ├── watchlist/          # Watchlist CRUD
│   │   ├── monitor/            # Review monitoring
│   │   ├── sentiment-alerts/   # 1★/2★ alert CRUD
│   │   ├── competitor/         # Competitor analysis
│   │   ├── compare/            # Side-by-side report comparison
│   │   ├── report/[id]/        # Report fetch + public share token
│   │   ├── referral/           # Referral code generation + claims
│   │   ├── blog/               # Blog CRUD (admin-gated write)
│   │   ├── admin/stats/        # Admin dashboard stats
│   │   ├── account/delete/     # Account deletion + Stripe cancel
│   │   ├── stripe/
│   │   │   ├── checkout/       # Create Stripe Checkout Session
│   │   │   ├── portal/         # Open Stripe billing portal
│   │   │   └── webhook/        # Handle Stripe payment events (idempotent)
│   │   └── cron/               # Vercel cron jobs
│   │       ├── monitor/        # Daily 08:00 UTC — re-analyze monitored listings
│   │       ├── digest/         # Monday 09:00 UTC — weekly email digest
│   │       └── sentiment-digest/ # Daily 10:00 UTC — run sentiment alerts
│   ├── auth/
│   │   ├── callback/           # OAuth code exchange + pending-checkout redirect
│   │   └── reset-password/     # Password reset page
│   ├── components/             # Shared React components
│   │   ├── AuthModal.tsx       # Google OAuth + email signup (plan-aware)
│   │   ├── CheckoutButton.tsx  # Stripe checkout (handles unauthenticated users)
│   │   ├── CheckoutRedirectHandler.tsx  # Completes checkout after OAuth signup
│   │   └── ...
│   ├── dashboard/              # All dashboard pages (protected by middleware)
│   ├── lib/                    # Shared server-side modules
│   │   ├── credit-costs.ts     # ← Single source of truth for all credit costs
│   │   ├── amazon-scraper.ts   # Multi-provider scraping fallback chain
│   │   ├── mistral-fallback.ts # 3-tier LLM fallback chain
│   │   ├── health-score.ts     # Review health score algorithm
│   │   ├── seo-scorer.ts       # SEO score calculator
│   │   ├── plan-limits.ts      # Report content gating by plan
│   │   ├── csv-analysis.ts     # CSV bulk analysis pipeline
│   │   ├── email.ts            # Resend email templates
│   │   ├── csrf.ts             # CSRF protection
│   │   ├── rate-limit.ts       # Upstash Redis rate limiter
│   │   └── supabase/           # Supabase clients (server + browser)
│   ├── blog/, faq/, terms/, privacy/  # Marketing pages
│   ├── report/[id]/            # Public shareable report view
│   ├── page.tsx                # Landing page
│   └── layout.tsx              # Root layout (DM Sans font, Sentry, Analytics)
├── supabase/                   # SQL migration files
├── public/                     # Static assets
├── proxy.ts                    # Next.js middleware (session refresh + CSP + auth guard)
├── .env.example                # Template for required environment variables
└── .github/workflows/ci.yml   # CI: typecheck + lint + test on every push
```

---

## Database (Supabase)

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | Profile — plan, credits, pack_credits, stripe IDs, is_admin, referral_code |
| `reports` | Analysis reports (full_report JSONB, status, asin, type) |
| `watchlist` | Tracked listings with initial_score |
| `watchlist_history` | Score snapshots for sparkline charts |
| `monitored_listings` | Listings enrolled in review monitoring |
| `monitor_history` | Monitor run results |
| `sentiment_alerts` | Scheduled 1★/2★ alert configs |
| `competitor_usage` | Per-product competitor analysis usage tracking |
| `referrals` / `referral_claims` | Referral program tracking |
| `processed_webhook_events` | Stripe webhook idempotency log |
| `asin_review_cache` | 7-day review cache to reduce scraping API spend |
| `blog_posts` | Blog content |

### Key RPCs

| Function | Purpose |
|----------|---------|
| `deduct_credits(user_id, amount)` | Atomically deducts credits; fails if insufficient |
| `add_credits(user_id, amount)` | Adds credits (webhook, refunds) |
| `add_pack_credits(user_id, amount)` | Adds one-time pack credits (never reset on renewal) |
| `increment_referral_count(user_id)` | Atomically increments referral counter |

All tables have RLS. Service role key used only in webhook and admin routes.

---

## Authentication Flow

1. User clicks sign up → `AuthModal` opens (plan-aware — carries pending plan/pack)
2. Google OAuth or email signup
3. Callback at `/auth/callback` — exchanges code, detects pending checkout, redirects to dashboard
4. `proxy.ts` refreshes session cookie on every request
5. `/dashboard` redirects to `/` if no valid session

---

## Payment Flow

1. User clicks upgrade → `CheckoutButton` → `/api/stripe/checkout`
2. Unauthenticated users: redirected through OAuth with `pendingPlan`/`pendingPack` params
3. Stripe Checkout Session created (idempotent per minute)
4. User pays on Stripe-hosted page
5. `checkout.session.completed` webhook → verifies signature → idempotency check → updates `users.plan` + credits
6. `CheckoutRedirectHandler` on dashboard detects `?checkout=` param and completes flow

---

## Environment Variables

See `.env.example` for the full list with descriptions. All secrets live in Vercel environment variables — never committed to the repo.

---

## Deployment

- **Hosting:** Vercel (auto-deploys on every push to `main`)
- **Domain:** voxrate.app via Cloudflare DNS → Vercel
- **Stripe webhook:** https://voxrate.app/api/stripe/webhook
- **Cron jobs:** Defined in `vercel.json` — monitor (08:00 UTC daily), digest (09:00 UTC Mondays), sentiment-digest (10:00 UTC daily)

```bash
git add .
git commit -m "your message"
git push
# Vercel auto-deploys
```

---

## Admin Access

Set via Supabase SQL:
```sql
UPDATE users SET is_admin = true, plan = 'pro', credits = 999999 WHERE email = 'your@email.com';
```

Admins bypass all plan restrictions and have access to `/dashboard/admin`.

---

## Developer

- **Name:** Naser Almasry
- **Built:** May 2026
- **Stack:** Next.js 16 + Supabase + Vercel + Stripe + Mistral/Groq
