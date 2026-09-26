// Web-side pieces of student sign-in (Task 10) that are testable outside a
// DOM: the auth-store plumbing, the roster fetch's error mapping, and i18n
// coverage for the picture aria-labels. ClassSignInPage/NameTiles/PicturePad
// are exercised by hand (simulator/browser) and by `npx vite build` — this
// suite runs in vitest's `node` environment, with no DOM.
import { describe, it, expect, vi } from 'vitest'
import { PICTURE_IDS } from '../lib/school/pictures.js'

// `app_metadata` is only ever set server-side (see api/_school.js's
// `isStudent`); `user_metadata` is user-writable and must never gate
// anything — mirrors the same rule enforced server-side.
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      setSession: vi.fn(async () => ({ data: {}, error: null })),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => {},
    },
  },
}))

import { supabase } from '../src/lib/supabase'
import { useAuthStore, selectIsStudent } from '../src/stores/useAuthStore'
import { fetchRoster } from '../src/lib/schoolApi.js'
import enSchool from '../src/i18n/locales/en/school.json'
import itSchool from '../src/i18n/locales/it/school.json'

describe('selectIsStudent', () => {
  it('is true when app_metadata.role is student', () => {
    expect(selectIsStudent({ user: { app_metadata: { role: 'student' } } })).toBe(true)
  })

  it('is false for user_metadata.role — that field is client-writable and must never gate access', () => {
    expect(selectIsStudent({ user: { user_metadata: { role: 'student' } } })).toBe(false)
  })

  it('is false with no user at all', () => {
    expect(selectIsStudent({ user: null })).toBe(false)
  })
})

describe('signInAsStudent', () => {
  it('sets the Supabase session from both tokens', async () => {
    await useAuthStore.getState().signInAsStudent({ access_token: 'access-1', refresh_token: 'refresh-1' })
    expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: 'access-1', refresh_token: 'refresh-1' })
  })

  it('throws when Supabase rejects the session', async () => {
    supabase.auth.setSession.mockResolvedValueOnce({ data: {}, error: new Error('invalid refresh token') })
    await expect(
      useAuthStore.getState().signInAsStudent({ access_token: 'bad', refresh_token: 'bad' })
    ).rejects.toThrow('invalid refresh token')
  })
})

describe('fetchRoster', () => {
  it('maps a 423 class_resting response to {ok:false, code}', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'Class not available', code: 'class_resting' }), { status: 423 })
    )
    const result = await fetchRoster('ABC234')
    expect(result).toMatchObject({ ok: false, code: 'class_resting' })
  })

  it('maps a 200 response to {ok:true, data}', async () => {
    const data = { classroom: { id: 'c1', name: 'Room 5', locale: 'en' }, students: [] }
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(data), { status: 200 }))
    const result = await fetchRoster('ABC234')
    expect(result).toMatchObject({ ok: true, data })
  })
})

describe('school picture translations', () => {
  it('has an EN and IT aria-label for every picture id, for screen readers', () => {
    for (const id of PICTURE_IDS) {
      expect(enSchool.pictures?.[id], `en missing pictures.${id}`).toBeTypeOf('string')
      expect(itSchool.pictures?.[id], `it missing pictures.${id}`).toBeTypeOf('string')
    }
  })
})
