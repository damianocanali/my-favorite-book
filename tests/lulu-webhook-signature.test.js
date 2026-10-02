// Review §7 item 21: the Lulu webhook accepts exactly one signature scheme.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { pinnedScheme, verifyLuluSignature } from '../api/webhooks/lulu.js'

const body = JSON.stringify({ data: { id: '123', status: { name: 'SHIPPED' } } })
const sig = (secret, enc = 'hex') => createHmac('sha256', secret).update(body).digest(enc)
const req = (headers) => new Request('https://app.test/api/webhooks/lulu', { method: 'POST', headers, body })

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('pinnedScheme', () => {
  it('defaults to Lulu-HMAC-SHA256 / hex, webhook secret first', () => {
    expect(pinnedScheme({ LULU_CLIENT_SECRET: 'c' })).toEqual({ header: 'lulu-hmac-sha256', secretEnv: 'LULU_CLIENT_SECRET', encoding: 'hex' })
    expect(pinnedScheme({ LULU_WEBHOOK_SECRET: 'w', LULU_CLIENT_SECRET: 'c' }).secretEnv).toBe('LULU_WEBHOOK_SECRET')
  })
  it('LULU_WEBHOOK_SCHEME pins the scheme the old verifier logged; garbage pins nothing', () => {
    expect(pinnedScheme({ LULU_WEBHOOK_SCHEME: 'x-lulu-hmac-sha256:LULU_CLIENT_SECRET:base64' }))
      .toEqual({ header: 'x-lulu-hmac-sha256', secretEnv: 'LULU_CLIENT_SECRET', encoding: 'base64' })
    expect(pinnedScheme({ LULU_WEBHOOK_SCHEME: 'authorization:STRIPE_SECRET_KEY:hex' })).toBeNull()
  })
})

describe('verifyLuluSignature', () => {
  const env = { LULU_CLIENT_SECRET: 'client-secret' }
  it('accepts the pinned scheme', async () => {
    expect(await verifyLuluSignature(req({ 'Lulu-HMAC-SHA256': sig('client-secret') }), body, env)).toBe('lulu-hmac-sha256:LULU_CLIENT_SECRET:hex')
  })
  it('rejects every other header, encoding or secret the old verifier tried', async () => {
    expect(await verifyLuluSignature(req({ 'Lulu-Signature': sig('client-secret') }), body, env)).toBeNull()
    expect(await verifyLuluSignature(req({ 'X-Lulu-HMAC-SHA256': sig('client-secret') }), body, env)).toBeNull()
    expect(await verifyLuluSignature(req({ 'Lulu-HMAC-SHA256': sig('client-secret', 'base64') }), body, env)).toBeNull()
    expect(await verifyLuluSignature(req({ 'Lulu-HMAC-SHA256': sig('other') }), body, { ...env, LULU_WEBHOOK_SECRET: 'w' })).toBeNull()
    expect(await verifyLuluSignature(req({}), body, env)).toBeNull()
  })
  it('a malformed override refuses everything', async () => {
    expect(await verifyLuluSignature(req({ 'Lulu-HMAC-SHA256': sig('client-secret') }), body, { ...env, LULU_WEBHOOK_SCHEME: 'nope' })).toBeNull()
  })
})
