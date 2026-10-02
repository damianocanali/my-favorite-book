// Story Buddy data minimisation (privacy review §7 item 9): the child's name
// and exact age never reach Anthropic — only "the young author" and a band.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { ageBandFor } from '../api/story-buddy.js'
import { buddyBook, ageBand } from '../src/services/storyBuddy.js'

vi.mock('../api/_auth.js', () => ({
  verifyJwt: vi.fn(async () => ({ ok: true, userId: 'u1', email: 'a@b.c', appMetadata: {} })),
}))
vi.mock('../api/_appAttest.js', () => ({
  classifyAttestation: vi.fn(async () => ({ attested: true })),
  hourlyLimitFor: (_a, n) => n,
}))
vi.mock('../api/_rateLimit.js', async (importOriginal) => ({
  ...(await importOriginal()),
  checkRateLimit: () => ({ allowed: true, remaining: 99 }),
}))

const NAME = 'Zephyrine Quackenbush'
const book = {
  title: 'The Fox',
  authorName: NAME,
  authorAge: 7,
  characters: [{ name: 'Neo' }],
  setting: { name: 'Forest' },
  pages: [{ pageNumber: 1, text: 'Once upon a time' }],
}

describe('age bands', () => {
  it('server bands an exact age and prefers a client band', () => {
    expect(ageBandFor({ authorAge: 5 })).toBe('6-8')
    expect(ageBandFor({ authorAge: 8 })).toBe('6-8')
    expect(ageBandFor({ authorAge: 9 })).toBe('9-10')
    expect(ageBandFor({ authorAge: 12 })).toBe('11-12')
    expect(ageBandFor({ authorAge: 16 })).toBe('11-12')
    expect(ageBandFor({ ageBand: '9-10', authorAge: 12 })).toBe('9-10')
    expect(ageBandFor({ ageBand: 'nine' })).toBe('6-8')
    expect(ageBandFor({})).toBe('6-8')
  })
  it('web client sends a band, never the name or exact age', () => {
    expect(ageBand(10)).toBe('9-10')
    expect(ageBand(undefined)).toBeUndefined()
    const out = buddyBook({ ...book, pages: [{ pageNumber: 1, text: 'x', illustrationData: 'data:image/png;base64,AA' }] }, (k) => k)
    expect(out).not.toHaveProperty('authorName')
    expect(out).not.toHaveProperty('authorAge')
    expect(out.ageBand).toBe('6-8')
    expect(JSON.stringify(out)).not.toContain(NAME)
    expect(JSON.stringify(out)).not.toContain('illustrationData')
  })
  it('iOS client sends ageBand, not authorName/authorAge', () => {
    const swift = readFileSync(new URL('../ios-native/MyBookLab/Services/APIClient.swift', import.meta.url), 'utf8')
    const slim = swift.slice(swift.indexOf('struct SlimBook'), swift.indexOf('struct SlimCharacter'))
    expect(slim).toContain('ageBand')
    expect(slim).not.toContain('authorName')
    expect(slim).not.toContain('authorAge')
  })
})

describe('POST /api/story-buddy body sent to Anthropic', () => {
  let calls
  const origEnv = { ...process.env }
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'openai'
    process.env.ANTHROPIC_API_KEY = 'anthropic'
    calls = []
    globalThis.fetch = vi.fn(async (url, init) => {
      const u = String(url)
      calls.push({ u, body: init?.body ? String(init.body) : '' })
      if (u.includes('moderations')) return new Response(JSON.stringify({ results: [{ flagged: false }] }))
      if (u.includes('api.anthropic.com')) return new Response(JSON.stringify({ content: [{ text: '1. Hi' }], usage: {} }))
      return new Response(null, { status: 201 })
    })
  })
  afterEach(() => { process.env = { ...origEnv } })

  const post = async (payload) => {
    const { default: handler } = await import('../api/story-buddy.js')
    return handler(new Request('https://app.test/api/story-buddy', {
      method: 'POST',
      headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }))
  }

  it('an OLD client that still sends authorName/authorAge leaks neither', async () => {
    const res = await post({ intent: 'starters', book, page: { pageNumber: 1, text: '' } })
    expect(res.status).toBe(200)
    const [a] = calls.filter((c) => c.u.includes('api.anthropic.com'))
    expect(a.body).not.toContain(NAME)
    expect(a.body).not.toContain('authorName')
    expect(a.body).not.toMatch(/age 7\b|7-year-old|aged 7\b/)
    expect(a.body).toContain('the young author')
    expect(a.body).toContain('6-8')
  })

  it('a NEW client payload (buddyBook) also leaks neither', async () => {
    await post({ intent: 'questions', book: buddyBook({ ...book, authorAge: 11 }, (k) => k), page: { pageNumber: 1, text: '' } })
    const [a] = calls.filter((c) => c.u.includes('api.anthropic.com'))
    expect(a.body).not.toContain(NAME)
    expect(a.body).toContain('11-12')
    expect(a.body).not.toMatch(/\b11-year-old|age 11\)/)
  })
})
