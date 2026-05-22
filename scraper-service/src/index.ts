import Fastify from 'fastify'
import { randomUUID } from 'crypto'
import { scrape } from './scraper.js'
import type { Job, ScrapeRequest } from './types.js'

const app = Fastify({ logger: true })

// In-memory job store — fine for a single Railway instance at our volume.
// Jobs auto-expire after 10 minutes to prevent memory leaks.
const jobs = new Map<string, Job>()
const JOB_TTL_MS = 10 * 60 * 1000

function evictStaleJobs() {
  const cutoff = Date.now() - JOB_TTL_MS
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id)
  }
}
setInterval(evictStaleJobs, 60_000)

// Shared secret auth — Vercel sends this header on every request
const SECRET = process.env.SCRAPER_SECRET
app.addHook('onRequest', async (req, reply) => {
  if (!SECRET) return
  if (req.url === '/health') return  // healthcheck must be public
  if (req.headers['x-scraper-secret'] !== SECRET) {
    reply.code(401).send({ error: 'Unauthorized' })
  }
})

// POST /jobs — queue a new scrape job, return job ID immediately
app.post<{ Body: ScrapeRequest }>('/jobs', async (req, reply) => {
  const { url, asin, marketplace, maxReviews } = req.body

  if (!url || !asin || !marketplace || !maxReviews) {
    return reply.code(400).send({ error: 'Missing required fields: url, asin, marketplace, maxReviews' })
  }

  const id: string = randomUUID()
  const job: Job = {
    id,
    request: { url, asin, marketplace, maxReviews },
    status:    'pending',
    createdAt: Date.now(),
  }
  jobs.set(id, job)

  // Run in background — don't await
  runJob(job)

  return reply.code(202).send({ jobId: id, status: 'pending' })
})

// GET /jobs/:id — poll job status
app.get<{ Params: { id: string } }>('/jobs/:id', async (req, reply) => {
  const job = jobs.get(req.params.id)
  if (!job) return reply.code(404).send({ error: 'Job not found or expired' })

  return reply.send({
    jobId:    job.id,
    status:   job.status,
    reviews:  job.reviews,
    error:    job.error,
  })
})

// GET /health — Railway health check
app.get('/health', async () => ({ ok: true, jobs: jobs.size }))

async function runJob(job: Job) {
  job.status = 'running'
  try {
    const reviews  = await scrape(job.request)
    job.reviews    = reviews
    job.status     = 'done'
    app.log.info(`[Job ${job.id}] done — ${reviews.length} reviews for ${job.request.asin}`)
  } catch (err: any) {
    job.status = 'error'
    job.error  = err.message ?? 'Unknown scrape error'
    app.log.error(`[Job ${job.id}] error: ${job.error}`)
  }
}

const port = parseInt(process.env.PORT ?? '3001')
app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) { app.log.error(err); process.exit(1) }
  app.log.info(`Scraper service listening on port ${port}`)
})
