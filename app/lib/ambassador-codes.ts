const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function randomChars(n: number): string {
  let out = ''
  const bytes = new Uint8Array(n)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
    for (let i = 0; i < n; i++) out += CHARS[bytes[i] % CHARS.length]
    return out
  }
  for (let i = 0; i < n; i++) out += CHARS[Math.floor(Math.random() * CHARS.length)]
  return out
}

export function generateAmbassadorCode(): string {
  return `AMB-${randomChars(4)}-${randomChars(4)}`
}

export function generateProCode(): string {
  return `PRO-${randomChars(4)}-${randomChars(4)}`
}

export function generateReferralCode(): string {
  return randomChars(6)
}
