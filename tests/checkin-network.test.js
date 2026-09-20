import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { useCheckInStore } from '../src/stores/useCheckInStore'

// The single most likely future regression in this feature is someone
// syncing it — "so parents can see how their child is doing" is a reasonable
// thing to ask for and a serious thing to build. Synced, these entries become
// a wellbeing record about a named child: sensitive data under GDPR, a DPIA
// trigger, and a reason for the child to answer dishonestly.
//
// Two guards: no network call at runtime, and no /api reference in the
// source. The second catches it even if the call sits behind a condition the
// first never reaches.

describe('check-in data never leaves the device', () => {
  beforeEach(() => useCheckInStore.setState({ current: null, entries: [], lastPromptedAt: null }))

  it('makes no network call when a check-in completes', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchSpy)

    useCheckInStore.getState().open('breakpoint')
    useCheckInStore.getState().pickFeeling('angry')
    useCheckInStore.getState().pickNeed('break')
    await new Promise((r) => setTimeout(r, 0))

    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('has no /api reference in any check-in source file', () => {
    const files = [
      'src/lib/checkIn.js',
      'src/stores/useCheckInStore.js',
      'src/components/ui/CheckInSheet.jsx',
      'src/components/ui/CheckInHost.jsx',
      'src/components/ui/CheckInButton.jsx',
      'src/components/ui/BreakScreen.jsx',
      'src/components/ui/FeelingConstellation.jsx',
    ]
    const offenders = files.filter((f) => {
      const src = readFileSync(f, 'utf8')
      // Ignore the explanatory comments, which legitimately mention /api.
      const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      return /['"`]\/api\/|apiFetch|fetch\s*\(/.test(code)
    })
    expect(offenders, `check-in files must not talk to the server:\n${offenders.join('\n')}`).toEqual([])
  })
})
