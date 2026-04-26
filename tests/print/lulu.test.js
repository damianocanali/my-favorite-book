import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LuluClient } from '../../lib/print/lulu.js'

beforeEach(() => { global.fetch = vi.fn() })

describe('LuluClient.getToken', () => {
  it('OAuth POSTs and returns access_token, caches it', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'abc', expires_in: 3600 }),
    })
    const c = new LuluClient()
    expect(await c.getToken()).toBe('abc')
    expect(await c.getToken()).toBe('abc')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('LuluClient.createPrintJob', () => {
  it('POSTs print-jobs with bearer + payload', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'abc', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 99, status: { name: 'CREATED' } }) })

    const c = new LuluClient()
    const job = await c.createPrintJob({
      external_id: 'order-1',
      contact_email: 'p@x.com',
      shipping_level: 'MAIL',
      shipping_address: { name: 'X', street1: 'A', city: 'B', state_code: 'TX', country_code: 'US', postcode: '78701' },
      line_items: [{ external_id: 'order-1-1', quantity: 1, pod_package_id: 'square-hardcover-id', interior: { source_url: 'https://x/i.pdf' }, cover: { source_url: 'https://x/c.pdf' }, title: 'My Bear' }],
    })
    expect(job.id).toBe(99)
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer abc')
  })

  it('throws on 4xx with diagnostic', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'abc', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => '{"detail":"bad address"}' })
    const c = new LuluClient()
    await expect(c.createPrintJob({ external_id: 'x', contact_email: 'a@b', shipping_level: 'MAIL', shipping_address: {}, line_items: [] })).rejects.toThrow(/lulu createPrintJob.*400/i)
  })
})
