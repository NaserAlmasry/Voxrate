# Local Development Setup

## Prerequisites

- Node.js 20+
- npm
- A Supabase project
- API keys for Mistral, Groq, Canopy, Stripe, Upstash, Resend (see `.env.example`)

---

## 1. Clone & Install

```bash
git clone https://github.com/NaserAlmasry/Voxrate
cd voxrate
npm install
```

---

## 2. Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in all values. The minimum set to get the app running locally:

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API |
| `MISTRAL_API_KEY` | console.mistral.ai |
| `GROQ_API_KEY` | console.groq.com |
| `CANOPY_API_KEY` | canopyapi.co |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys (use `sk_test_` for local) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe dashboard (use `pk_test_` for local) |
| `STRIPE_WEBHOOK_SECRET` | See Stripe webhook setup below |
| `UPSTASH_REDIS_REST_URL` | Upstash console → Redis database |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console → Redis database |
| `RESEND_API_KEY` | resend.com → API Keys |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for local dev |
| `CRON_SECRET` | Any random string (used to auth cron endpoints locally) |

---

## 3. Database

The Supabase database schema is managed via migration files in `supabase/`. Apply them in order in the Supabase SQL editor:

```
supabase/add_pack_credits.sql
supabase/add_competitor_tracking.sql
supabase/add_competitor_usage_table.sql
supabase/add_referral_program.sql
supabase/add_sentiment_alerts.sql
supabase/add_blog.sql
supabase/watchlist_delta_migration.sql
```

The base schema (users, reports, watchlist, etc.) lives in the Supabase project directly. Contact the project owner for a full schema dump.

---

## 4. Stripe Webhooks (local)

To test Stripe webhooks locally, install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret it outputs and set it as `STRIPE_WEBHOOK_SECRET` in `.env.local`.

---

## 5. Run

```bash
npm run dev
```

Open http://localhost:3000

---

## 6. Verify Setup

- Landing page loads at http://localhost:3000
- Clicking "Sign In" opens the auth modal
- `/dashboard` redirects to `/` if not logged in

---

## Common Issues

| Problem | Fix |
|---------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` missing | Check `.env.local` exists and has correct values |
| Auth callback fails | Ensure `http://localhost:3000/auth/callback` is in Supabase Auth → URL Configuration → Redirect URLs |
| Stripe webhook 400 | Run `stripe listen` and update `STRIPE_WEBHOOK_SECRET` |
| Rate limit errors | Check Upstash Redis keys are correct |

---

## Running Tests

```bash
npm test                    # run tests once
npm test -- --watch         # watch mode
npm test -- --coverage      # with coverage report
npx tsc --noEmit            # type check
npm run lint                # lint
```
