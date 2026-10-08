// Web side of Atlas referrals: ?ref capture (silent, strips the param,
// keeps the rest) and the one-shot attach after sign-in.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripRefParam, captureReferralFromUrl, attachReferralIfPending, readReferralCode, dismissReferralCode, _resetForTests } from '../src/lib/atlasReferral.js'

const res = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status })
function fakeWindow(href) {
  const w = new EventTarget()
  w.location = { href }
  w.history = { state: { idx: 3 }, replaceState: vi.fn((state, _t, url) => { w.location.href = new URL(url, href).href }) }
  return w
}

beforeEach(() => { _resetForTests(); localStorage.clear() })

describe('stripRefParam', () => {
  it('removes ref and keeps everything else', () => {
    expect(stripRefParam('https://mybooklab.app/signup?role=teacher&ref=abc.def&x=1#top')).toBe('/signup?role=teacher&x=1#top')
    expect(stripRefParam('https://mybooklab.app/?ref=abc')).toBe('/')
    expect(stripRefParam('https://mybooklab.app/?a=1')).toBeNull()
  })
})

describe('captureReferralFromUrl', () => {
  it('posts the ref, strips it (keeping router state), stores the code and announces it', async () => {
    const w = fakeWindow('https://mybooklab.app/?ref=tok.sig&utm=x')
    const seen = vi.fn()
    w.addEventListener('mbl-atlas-code', seen)
    const f = vi.fn(async () => res(200, { code: 'K7M4-Q2XP' }))
    await captureReferralFromUrl({ win: w, fetchImpl: f })
    expect(f).toHaveBeenCalledWith('/api/referral/capture', expect.objectContaining({ method: 'POST', body: JSON.stringify({ ref: 'tok.sig' }) }))
    expect(w.history.replaceState).toHaveBeenCalledWith({ idx: 3 }, '', '/?utm=x')
    expect(readReferralCode()).toBe('K7M4-Q2XP')
    expect(seen).toHaveBeenCalled()
    dismissReferralCode()
    expect(readReferralCode()).toBeNull()
  })
  it('no ref → no request', async () => {
    const f = vi.fn()
    await captureReferralFromUrl({ win: fakeWindow('https://mybooklab.app/pricing'), fetchImpl: f })
    expect(f).not.toHaveBeenCalled()
  })
  it('invalid (204) or a network error → silent, nothing stored, ref still stripped', async () => {
    for (const f of [vi.fn(async () => res(204)), vi.fn(async () => { throw new TypeError('offline') })]) {
      _resetForTests()
      const w = fakeWindow('https://mybooklab.app/?ref=junk')
      await expect(captureReferralFromUrl({ win: w, fetchImpl: f })).resolves.toBeUndefined()
      expect(w.location.href).toBe('https://mybooklab.app/')
      expect(readReferralCode()).toBeNull()
    }
  })
})

describe('attachReferralIfPending', () => {
  it('attaches once after sign-in, only when a capture happened', async () => {
    const f = vi.fn(async () => res(200, { attached: true }))
    await attachReferralIfPending('u1', { fetchImpl: f })
    expect(f).not.toHaveBeenCalled()
    await captureReferralFromUrl({ win: fakeWindow('https://mybooklab.app/?ref=t.s'), fetchImpl: async () => res(200, { code: 'K7M4-Q2XP' }) })
    await attachReferralIfPending('u1', { fetchImpl: f })
    await attachReferralIfPending('u1', { fetchImpl: f })
    expect(f).toHaveBeenCalledTimes(1)
    expect(f).toHaveBeenCalledWith('/api/referral/attach', expect.objectContaining({ method: 'POST' }))
    expect(readReferralCode()).toBeNull()
  })
  it('signed-in capture (attached server-side) leaves nothing pending', async () => {
    await captureReferralFromUrl({ win: fakeWindow('https://mybooklab.app/?ref=t.s'), fetchImpl: async () => res(200, { attached: true }) })
    const f = vi.fn()
    await attachReferralIfPending('u1', { fetchImpl: f })
    expect(f).not.toHaveBeenCalled()
  })
})

describe('wiring', () => {
  it('App captures on load; the auth store attaches on sign-in and on an OAuth return', () => {
    expect(readFileSync('src/App.jsx', 'utf8')).toContain('captureReferralFromUrl()')
    const store = readFileSync('src/stores/useAuthStore.js', 'utf8')
    expect(store.match(/attachReferralIfPending\(/g)).toHaveLength(2)
  })
  it('the note is on the landing and sign-up pages', () => {
    for (const p of ['src/pages/LandingPage.jsx', 'src/pages/SignupPage.jsx']) expect(readFileSync(p, 'utf8')).toContain('<AtlasCodeNote')
  })
})
