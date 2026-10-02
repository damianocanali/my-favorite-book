// Review §7 item 21 (coordinator ruling): default = the schemes the old code
// accepted, logging which one verified; LULU_WEBHOOK_SCHEME pins one.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { pinnedScheme, verifyLuluSignature } from '../api/webhooks/lulu.js'

const body = JSON.stringify({ data: { id: '123', status: { name: 'SHIPPED' } } })
const sig = (secret, enc = 'hex') => createHmac('sha256', secret).update(body).digest(enc)
const req = (headers) => new Request('https://app.test/api/webhooks/lulu', { method: 'POST', headers, body })
const env = { LULU_CLIENT_SECRET: 'client-secret', LULU_WEBHOOK_SECRET: 'hook-secret' }

beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('pinnedScheme', () => {
  it('unset = default mode; valid = pinned; garbage = null', () => {
    expect(pinnedScheme({})).toBeUndefined()
    expect(pinnedScheme({ LULU_WEBHOOK_SCHEME: 'Lulu-HMAC-SHA256:LULU_CLIENT_SECRET:hex' }))
      .toEqual({ header: 'lulu-hmac-sha256', secretEnv: 'LULU_CLIENT_SECRET', encoding: 'hex' })
    expect(pinnedScheme({ LULU_WEBHOOK_SCHEME: 'authorization:STRIPE_SECRET_KEY:hex' })).toBeNull()
  })
})

describe('default mode keeps the old behaviour', () => {
  it.each([
    ['Lulu-HMAC-SHA256', 'client-secret', 'hex', 'lulu-hmac-sha256:LULU_CLIENT_SECRET:hex'],
    ['X-Lulu-HMAC-SHA256', 'hook-secret', 'base64', 'x-lulu-hmac-sha256:LULU_WEBHOOK_SECRET:base64'],
    ['Lulu-Signature', 'client-secret', 'base64', 'lulu-signature:LULU_CLIENT_SECRET:base64'],
  ])('%s signed with %s (%s) → %s', async (header, secret, enc, name) => {
    expect(await verifyLuluSignature(req({ [header]: sig(secret, enc) }), body, env)).toBe(name)
  })
  it('a wrong signature or no header is refused', async () => {
    expect(await verifyLuluSignature(req({ 'Lulu-HMAC-SHA256': sig('other') }), body, env)).toBeNull()
    expect(await verifyLuluSignature(req({}), body, env)).toBeNull()
  })
})

describe('pinned mode accepts only that scheme', () => {
  const pinned = { ...env, LULU_WEBHOOK_SCHEME: 'lulu-hmac-sha256:LULU_CLIENT_SECRET:hex' }
  it('accepts it', async () => {
    expect(await verifyLuluSignature(req({ 'Lulu-HMAC-SHA256': sig('client-secret') }), body, pinned)).toBe('lulu-hmac-sha256:LULU_CLIENT_SECRET:hex')
  })
  it('refuses the other combinations the default mode would take', async () => {
    expect(await verifyLuluSignature(req({ 'Lulu-Signature': sig('client-secret') }), body, pinned)).toBeNull()
    expect(await verifyLuluSignature(req({ 'Lulu-HMAC-SHA256': sig('client-secret', 'base64') }), body, pinned)).toBeNull()
    expect(await verifyLuluSignature(req({ 'Lulu-HMAC-SHA256': sig('hook-secret') }), body, pinned)).toBeNull()
  })
  it('a malformed pin refuses everything', async () => {
    expect(await verifyLuluSignature(req({ 'Lulu-HMAC-SHA256': sig('client-secret') }), body, { ...env, LULU_WEBHOOK_SCHEME: 'nope' })).toBeNull()
  })
})

describe('handler logs the verified scheme by name only', () => {
  it('no secret or signature in the log line', async () => {
    process.env.LULU_CLIENT_SECRET = 'client-secret'
    delete process.env.LULU_WEBHOOK_SCHEME
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    globalThis.fetch = vi.fn(async () => new Response('[]'))
    const { default: handler } = await import('../api/webhooks/lulu.js')
    const s = sig('client-secret')
    const res = await handler(req({ 'Lulu-HMAC-SHA256': s }))
    expect(res.status).toBe(200)
    const line = log.mock.calls.map((c) => c.join(' ')).find((l) => l.includes('verified via'))
    expect(line).toContain('lulu-hmac-sha256:LULU_CLIENT_SECRET:hex')
    expect(line).not.toContain('client-secret')
    expect(line).not.toContain(s)
    delete process.env.LULU_CLIENT_SECRET
  })
})
