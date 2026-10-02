// Review §7 item 17: security headers in vercel.json.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'))
const all = cfg.headers.find((h) => h.source === '/(.*)').headers
const get = (k) => all.find((h) => h.key === k)?.value

describe('vercel.json security headers', () => {
  it('sets HSTS, nosniff, referrer policy, framing denial and a mic-only permissions policy', () => {
    expect(get('Strict-Transport-Security')).toMatch(/max-age=\d{8,}/)
    expect(get('X-Content-Type-Options')).toBe('nosniff')
    expect(get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(get('X-Frame-Options')).toBe('DENY')
    const pp = get('Permissions-Policy')
    expect(pp).toContain('microphone=(self)')
    expect(pp).toContain('camera=()')
  })
  it('CSP (report-only for now) is self-first, forbids framing and plugins, allows Supabase + Stripe', () => {
    const csp = get('Content-Security-Policy-Report-Only') ?? get('Content-Security-Policy')
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.supabase\.co[^;]*wss:\/\/\*\.supabase\.co/)
    expect(csp).toMatch(/script-src 'self' https:\/\/js\.stripe\.com/)
    expect(csp).toMatch(/font-src 'self' data:/)
    expect(csp).not.toMatch(/fonts\.googleapis|fonts\.gstatic|cdnfonts|unsafe-eval/)
    // Stripe Elements + wallets (Apple Pay / Google Pay)
    expect(csp).toMatch(/frame-src[^;]*https:\/\/\*\.js\.stripe\.com[^;]*https:\/\/pay\.google\.com/)
    expect(csp).toMatch(/img-src[^;]*applepay\.cdn-apple\.com/)
  })
  it('keeps the crons and rewrites intact', () => {
    expect(cfg.crons.length).toBeGreaterThan(0)
    expect(cfg.rewrites[0].destination).toBe('/index.html')
  })
})
