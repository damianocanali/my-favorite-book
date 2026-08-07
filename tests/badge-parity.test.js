import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// The badge catalog lives in three places that must agree:
//   src/stores/useRewardsStore.js  — what the web shows
//   ios-native/.../RewardsStore.swift — what iOS shows
//   api/claim-badge.js — what actually credits coins, and the only one
//                        that can reject an id ("Unknown badge")
//
// They had already drifted before this test existed: iOS was missing
// used_voice and submitted_class, so two badges a child could earn on the
// web were invisible in the native app's badge list. Parsing the real
// files rather than importing keeps the Swift side honest too.

const ids = (src, re) => {
  const out = new Set()
  for (const m of src.matchAll(re)) out.add(m[1])
  return out
}

const web = ids(
  readFileSync('src/stores/useRewardsStore.js', 'utf8'),
  /\{ id: '([a-z_0-9]+)'/g
)
const ios = ids(
  readFileSync('ios-native/MyBookLab/Stores/RewardsStore.swift', 'utf8'),
  /Badge\(id: "([a-z_0-9]+)"/g
)
const api = ids(
  readFileSync('api/claim-badge.js', 'utf8'),
  /^ {2}([a-z_0-9]+): *\d+,/gm
)

const diff = (a, b) => [...a].filter((x) => !b.has(x)).sort()

describe('badge catalog parity', () => {
  it('finds badges in all three sources', () => {
    expect(web.size).toBeGreaterThan(15)
    expect(ios.size).toBe(web.size)
    expect(api.size).toBe(web.size)
  })

  it('web and iOS show the same badges', () => {
    expect({ missingOnIos: diff(web, ios), missingOnWeb: diff(ios, web) })
      .toEqual({ missingOnIos: [], missingOnWeb: [] })
  })

  it('every badge the clients show can actually be claimed', () => {
    // An id missing from api/claim-badge.js BADGE_COINS is rejected with
    // "Unknown badge" — the child sees the badge and earns nothing.
    expect(diff(web, api)).toEqual([])
    expect(diff(ios, api)).toEqual([])
  })

  it('has no server-side badge the clients never show', () => {
    expect(diff(api, web)).toEqual([])
  })
})
