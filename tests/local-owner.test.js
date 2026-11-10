import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readLocalOwner, writeLocalOwner, belongsToSomeoneElse, LOCAL_OWNER_KEY } from '../src/lib/localOwner.js'

function fakeStorage() {
  const m = new Map()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }
}

describe('local data owner', () => {
  it('records, reads and forgets the owner', () => {
    const s = fakeStorage()
    expect(readLocalOwner(s)).toBe(null)
    writeLocalOwner('user-a', s)
    expect(s.m.get(LOCAL_OWNER_KEY)).toBe('user-a')
    expect(readLocalOwner(s)).toBe('user-a')
    writeLocalOwner(null, s)
    expect(readLocalOwner(s)).toBe(null)
  })

  it("flags another account's data, never a visitor's or your own", () => {
    expect(belongsToSomeoneElse('user-b', 'user-a')).toBe(true)
    expect(belongsToSomeoneElse('user-a', 'user-a')).toBe(false)
    expect(belongsToSomeoneElse('user-b', null)).toBe(false) // a visitor's drafts are adopted
  })

  it('survives a storage that throws', () => {
    const bad = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') }, removeItem() { throw new Error('x') } }
    expect(readLocalOwner(bad)).toBe(null)
    expect(() => writeLocalOwner('u', bad)).not.toThrow()
  })
})

describe('useAuthStore claims local data before syncing it', () => {
  const src = readFileSync('src/stores/useAuthStore.js', 'utf8')
  it('on page load and on every sign-in, before loadCloudBooks', () => {
    const init = src.indexOf('claimLocalDataFor(user.id)')
    expect(init).toBeGreaterThan(-1)
    expect(init).toBeLessThan(src.indexOf('loadCloudBooks(user.id)'))
    const change = src.indexOf('claimLocalDataFor(newUser.id)')
    expect(change).toBeGreaterThan(-1)
    expect(change).toBeLessThan(src.indexOf('loadCloudBooks(newUser.id)'))
  })
  it('forgets the owner whenever local data is cleared', () => {
    const clear = src.slice(src.indexOf('function clearLocalUserData'), src.indexOf('function claimLocalDataFor'))
    expect(clear).toContain('writeLocalOwner(null)')
  })
})
