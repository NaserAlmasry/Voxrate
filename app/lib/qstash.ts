import { Client } from '@upstash/qstash'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'

let _client: Client | null = null

export function getQStashClient(): Client | null {
  if (!process.env.QSTASH_TOKEN) return null
  if (!_client) _client = new Client({ token: process.env.QSTASH_TOKEN })
  return _client
}

export function getWorkerUrl(): string {
  return `${SITE_URL}/api/jobs/csv-worker`
}
