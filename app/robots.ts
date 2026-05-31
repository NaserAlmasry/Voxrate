import { MetadataRoute } from 'next'

const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Googlebot-Extended', 'Google-CloudVertexBot',
  'Amazonbot',
  'Meta-ExternalAgent', 'Meta-ExternalFetcher',
  'Applebot', 'Applebot-Extended',
  'DuckAssistBot',
  'MistralAI-User',
  'BingBot',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Allow all AI crawlers to access public content (especially /product/)
      ...AI_BOTS.map(bot => ({
        userAgent: bot,
        allow: ['/', '/product/'],
        disallow: ['/dashboard/', '/api/', '/auth/'],
      })),
      // General rule
      {
        userAgent: '*',
        allow: ['/', '/product/'],
        disallow: ['/dashboard/', '/api/', '/auth/'],
      },
    ],
    sitemap: 'https://voxrate.app/sitemap.xml',
    host: 'https://voxrate.app',
  }
}
