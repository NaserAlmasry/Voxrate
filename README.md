# Voxrate

AI-powered Amazon review analysis for sellers. Paste a product URL or ASIN and get a full health report — complaints, strengths, SEO keywords, listing grade, and actionable fixes.

**Live:** https://voxrate.app

---

## Quick Start

```bash
git clone https://github.com/NaserAlmasry/Voxrate
cd voxrate
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

Open http://localhost:3000

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest unit tests |
| `npx tsc --noEmit` | TypeScript type check |

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values. See `.env.example` for descriptions of each variable.

Required services:
- [Supabase](https://supabase.com) — database + auth
- [Mistral](https://mistral.ai) — primary AI
- [Groq](https://groq.com) — AI fallback
- [Canopy](https://canopyapi.co) — primary Amazon scraper
- [Stripe](https://stripe.com) — payments
- [Upstash](https://upstash.com) — Redis (rate limiting) + QStash (async jobs)
- [Resend](https://resend.com) — transactional email
- [Sentry](https://sentry.io) — error tracking

---

## Project Docs

See [PROJECT.md](./PROJECT.md) for full architecture, database schema, feature list, and payment flow.

---

## Deploy

Push to `main` — Vercel auto-deploys. Set all environment variables in the Vercel dashboard before deploying.
