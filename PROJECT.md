# Voxrate — Project Overview

## What is Voxrate?

Voxrate is an AI-powered review analysis SaaS for Etsy sellers. It scrapes a product listing's customer reviews, runs them through AI, and delivers a full health report — complaints, strengths, quick wins, SEO keywords, and actionable fixes. Sellers use it to improve their listings and increase sales without manually reading hundreds of reviews.

**Live URL:** https://voxrate.app

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | Supabase Auth (Google OAuth + Email) |
| Database | Supabase (PostgreSQL) |
| AI | Anthropic Claude (analysis) + Groq (fast inference) |
| Scraping | scrape.do (residential proxies, JS rendering) |
| Payments | Stripe (subscriptions + one-time credit packs) |
| Rate Limiting | Upstash Redis |
| Hosting | Vercel |
| Domain | voxrate.app (Cloudflare DNS) |
| Repo | GitHub (private) — NaserAlmasry/Voxrate |

---

## Core Features

### For Users
- **Review Analyzer** — paste any Etsy listing URL, get a full AI health report (score 0–100, complaints, strengths, quick wins, SEO keywords, listing grade)
- **Competitor Spy** — analyze competitor listings (Starter/Pro plans only)
- **Listing Grader** — A–F grade on title, tags, description, pricing
- **AI Rewriter** — rewrites product descriptions for SEO and conversions
- **Reply Generator** — generates professional replies to negative reviews
- **Listing Builder** — generates a full listing from scratch
- **Shop Health Dashboard** — aggregates scores across all analyzed listings
- **Watchlist** — track competitor listings over time
- **History** — view all past analyses

### Credit System
- Every analysis costs credits (own listing = 24cr, competitor = 48cr)
- Free plan: 24 credits (1 analysis)
- Starter plan: $9.99/mo = 720 credits/month
- Pro plan: $19.99/mo = 2,400 credits/month
- Credit packs (one-time): Starter $5.99 (120cr), Standard $14.99 (360cr), Pro $29.99 (840cr)
- Credits never expire for packs; subscription credits refresh monthly

---

## Project Structure

```
voxrate/
├── app/
│   ├── api/                    # All backend API routes
│   │   ├── analyze/            # Core review scraping + AI analysis
│   │   ├── analyze-section/    # Re-analyze individual report sections
│   │   ├── analyze-csv/        # Bulk CSV analysis
│   │   ├── grade/              # Listing grader
│   │   ├── rewrite/            # AI description rewriter
│   │   ├── reply/              # Review reply generator
│   │   ├── shop-health/        # Shop-wide health aggregation
│   │   ├── watchlist/          # Watchlist CRUD
│   │   ├── report/[id]/        # Report fetch + share
│   │   ├── stripe/
│   │   │   ├── checkout/       # Create Stripe checkout session
│   │   │   ├── portal/         # Open Stripe billing portal
│   │   │   └── webhook/        # Handle Stripe payment events
│   │   └── cron/               # Scheduled jobs (monitor, digest)
│   ├── auth/callback/          # OAuth callback — exchanges code for session
│   ├── components/             # Shared React components
│   ├── dashboard/              # All dashboard pages (protected)
│   │   ├── page.tsx            # Main analyze page
│   │   ├── layout.tsx          # Dashboard shell + nav + auth guard
│   │   ├── library/            # Saved reports
│   │   ├── history/            # All past reports
│   │   ├── competitor/         # Competitor analysis
│   │   ├── grade/              # Listing grader
│   │   ├── rewrite/            # Rewriter tool
│   │   ├── reply/              # Reply generator
│   │   ├── listing-builder/    # Listing builder
│   │   ├── shop-health/        # Shop health dashboard
│   │   ├── watchlist/          # Watchlist
│   │   ├── monitor/            # Review monitoring (coming soon)
│   │   ├── report/[id]/        # Full report view
│   │   └── settings/           # Account + billing settings
│   ├── lib/
│   │   ├── supabase/           # Supabase client (server + browser)
│   │   ├── csrf.ts             # CSRF protection (X-Requested-With)
│   │   └── rate-limit.ts       # Upstash Redis rate limiting
│   ├── page.tsx                # Landing page
│   ├── layout.tsx              # Root layout
│   ├── terms/                  # Terms of service
│   ├── privacy/                # Privacy policy
│   └── faq/                    # FAQ page
├── proxy.ts                    # Next.js 16 middleware (Supabase session refresh)
├── public/                     # Static assets (logo, favicon)
└── .env.local                  # Local environment variables (never committed)
```

---

## Database (Supabase)

### Tables
| Table | Purpose |
|-------|---------|
| `users` | User profile — plan, credits, stripe IDs, is_admin |
| `reports` | All analysis reports (full_report is JSON blob) |
| `watchlist` | Competitor listings being tracked |
| `processed_webhook_events` | Stripe webhook idempotency log |

### Key RPCs (Postgres Functions)
- `deduct_credits(p_user_id, p_amount)` — atomically deducts credits, fails if insufficient
- `add_credits(p_user_id, p_amount)` — adds credits (used by webhook on payment)

### Row-Level Security
All tables have RLS enabled. Users can only read/write their own rows. The webhook uses the Supabase service role key to bypass RLS.

---

## Authentication Flow

1. User clicks Login/Start free → AuthModal opens
2. Selects a plan → chooses Google OAuth or email+password
3. Google OAuth → redirects to `/auth/callback` → `exchangeCodeForSession` → redirect to `/dashboard`
4. Email signup → creates account → logs in directly (email confirmation is OFF)
5. Dashboard layout checks session via `supabase.auth.getSession()`
6. `proxy.ts` middleware refreshes session cookies on every request

---

## Payment Flow

1. User clicks upgrade → `CheckoutButton` calls `/api/stripe/checkout`
2. Server creates a Stripe Checkout Session with user metadata
3. User pays on Stripe-hosted page
4. Stripe sends `checkout.session.completed` webhook to `/api/stripe/webhook`
5. Webhook verifies signature → checks idempotency → updates user plan + adds credits in Supabase
6. Dashboard polls for plan update and shows success banner

---

## Environment Variables

All secrets are in `.env.local` locally and Vercel environment variables in production. Never committed to Git.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server only) |
| `ANTHROPIC_API_KEY` | Claude AI for analysis |
| `GROQ_API_KEY` | Groq for fast inference |
| `SCRAPEDO_API_KEY` | scrape.do for Etsy scraping |
| `STRIPE_SECRET_KEY` | Stripe server key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_STARTER_MONTHLY` | Live Stripe price ID |
| `STRIPE_PRICE_PRO_MONTHLY` | Live Stripe price ID |
| `STRIPE_PRICE_STARTER_PACK` | Live Stripe price ID |
| `STRIPE_PRICE_GROWTH_PACK` | Live Stripe price ID |
| `STRIPE_PRICE_PRO_PACK` | Live Stripe price ID |
| `UPSTASH_REDIS_REST_URL` | Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Redis token |
| `NEXT_PUBLIC_SITE_URL` | Production URL (https://voxrate.app) |

---

## Deployment

- **Hosting:** Vercel (auto-deploys on every push to `main`)
- **Domain:** voxrate.app via Cloudflare DNS → Vercel
- **Primary domain:** www.voxrate.app (voxrate.app redirects to www)
- **Stripe webhook:** https://voxrate.app/api/stripe/webhook

### To deploy a change:
```bash
git add .
git commit -m "description of change"
git push
```
Vercel picks it up automatically.

---

## Known Limitations / Coming Soon

- **Review monitoring** — UI exists but marked "coming soon" (needs Etsy API approval)
- **Etsy API** — applied for access; currently using scrape.do for scraping (gets ~4 reviews per page due to Etsy's JS pagination)
- **Email alerts** — planned for monitor feature
- **Annual billing** — UI accepts it but only monthly is implemented in Stripe

---

## Admin Access

Admin users have `is_admin = true` in the `users` table. Admins bypass plan restrictions (watchlist, competitor spy available on free plan). Set via Supabase SQL:
```sql
UPDATE users SET is_admin = true, plan = 'pro', credits = 999999 WHERE email = 'your@email.com';
```

---

## Contact / Owner

- **Developer:** Naser Almasry
- **Stack expertise:** Mobile & Cloud Computing (CS)
- **Built:** May 2026
