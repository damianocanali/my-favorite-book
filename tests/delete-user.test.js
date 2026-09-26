// Account deletion has to actually delete.
//
// The bug these guard against: published_books.user_id is ON DELETE SET NULL,
// so deleting the auth user does not remove the child's published books — it
// orphans them, leaving author_name (a child's first name) and author_age
// public forever AND destroying the only link back to them. Ordering is the
// whole fix, so ordering is what these assert.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { purgeUser } from '../lib/deleteUser.js'

const ENV = {
  supabaseUrl: 'https://example.supabase.co',
  serviceKey: 'service-key',
}
const USER = '11111111-2222-3333-4444-555555555555'

let calls

/// Records every request as "METHOD path" and answers with `ok` by default.
/// `overrides` maps a substring of the URL to a custom response.
function mockFetch(overrides = {}) {
  calls = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const method = init.method || 'GET'
    calls.push(`${method} ${String(url).replace(ENV.supabaseUrl, '')}`)
    for (const [needle, res] of Object.entries(overrides)) {
      if (String(url).includes(needle)) return res
    }
    return { ok: true, status: 200, json: async () => [], text: async () => '' }
  })
}

const indexOfCall = (needle) => calls.findIndex((c) => c.includes(needle))

describe('purgeUser', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('deletes the published gallery books', async () => {
    mockFetch()
    await purgeUser(USER, ENV)
    expect(calls).toContain(`DELETE /rest/v1/published_books?user_id=eq.${USER}`)
  })

  it('deletes published books BEFORE deleting the auth user', async () => {
    mockFetch()
    await purgeUser(USER, ENV)
    const books = indexOfCall('published_books')
    const authDelete = indexOfCall('/auth/v1/admin/users/')
    expect(books).toBeGreaterThanOrEqual(0)
    expect(authDelete).toBeGreaterThanOrEqual(0)
    // If this ever flips, the FK nulls user_id first and the rows become
    // both permanently public and permanently unfindable.
    expect(books).toBeLessThan(authDelete)
  })

  it('aborts without deleting the auth user when the book delete fails', async () => {
    mockFetch({
      'published_books': { ok: false, status: 500, json: async () => ({}), text: async () => 'boom' },
    })
    const result = await purgeUser(USER, ENV)
    expect(result).toEqual({ ok: false })
    // The account stays deletable tomorrow, with the link intact.
    expect(indexOfCall('/auth/v1/admin/users/')).toBe(-1)
  })

  it('deletes the user\'s stored illustrations from the public bucket', async () => {
    mockFetch({
      '/storage/v1/object/list/': {
        ok: true,
        status: 200,
        json: async () => [{ name: 'illustration-abc.png' }, { name: 'avatar-def.png' }],
        text: async () => '',
      },
    })
    await purgeUser(USER, ENV)

    expect(indexOfCall('DELETE /storage/v1/object/book-illustrations')).toBeGreaterThanOrEqual(0)
    const del = globalThis.fetch.mock.calls.find(
      ([url, init]) => String(url).includes('/storage/v1/object/book-illustrations') && init?.method === 'DELETE'
    )
    expect(JSON.parse(del[1].body)).toEqual({
      prefixes: [`${USER}/illustration-abc.png`, `${USER}/avatar-def.png`],
    })
  })

  it('still deletes the account when storage cleanup fails', async () => {
    mockFetch({
      '/storage/v1/object/list/': { ok: false, status: 503, json: async () => ({}), text: async () => '' },
    })
    const result = await purgeUser(USER, ENV)
    // An orphaned PNG must not keep an account alive — the rows carrying the
    // child's name and age are already gone at this point.
    expect(result).toEqual({ ok: true })
    expect(indexOfCall('/auth/v1/admin/users/')).toBeGreaterThanOrEqual(0)
  })

  it('does not list storage when there is nothing to delete', async () => {
    mockFetch({
      '/storage/v1/object/list/': { ok: true, status: 200, json: async () => [], text: async () => '' },
    })
    await purgeUser(USER, ENV)
    expect(indexOfCall('DELETE /storage/v1/object/book-illustrations')).toBe(-1)
    expect(indexOfCall('/auth/v1/admin/users/')).toBeGreaterThanOrEqual(0)
  })

  it('reports failure when the auth delete itself fails', async () => {
    mockFetch({
      '/auth/v1/admin/users/': { ok: false, status: 500, json: async () => ({}), text: async () => '' },
    })
    expect(await purgeUser(USER, ENV)).toEqual({ ok: false })
  })

  // Schools stage 1: a teacher's account can own classrooms (owner_user_id is
  // now ON DELETE RESTRICT — migration 018), and those classes hold students
  // whose auth users do NOT cascade from the classroom, only from
  // class_students. Deleting the teacher's auth user first would either fail
  // outright (RESTRICT) or, if it somehow didn't, strand those students.
  it('deletes legacy submissions by user before the auth delete', async () => {
    mockFetch()
    await purgeUser(USER, ENV)
    const submissionsDelete = indexOfCall(`submissions?user_id=eq.${USER}`)
    const authDelete = indexOfCall('/auth/v1/admin/users/')
    expect(submissionsDelete).toBeGreaterThanOrEqual(0)
    expect(authDelete).toBeGreaterThanOrEqual(0)
    expect(submissionsDelete).toBeLessThan(authDelete)
  })

  it('purges every class the user owns before deleting the auth user', async () => {
    mockFetch({
      [`classrooms?owner_user_id=eq.${USER}&select=id,code`]: {
        ok: true, status: 200, json: async () => [{ id: 'c1', code: 'ABC234' }], text: async () => '',
      },
      'class_students?classroom_id=eq.c1': {
        ok: true, status: 200, json: async () => [{ auth_user_id: 'kid1' }], text: async () => '',
      },
    })
    await purgeUser(USER, ENV)

    const kidAuthDelete = indexOfCall('DELETE /auth/v1/admin/users/kid1')
    const classroomDelete = indexOfCall('DELETE /rest/v1/classrooms?id=eq.c1')
    const teacherAuthDelete = indexOfCall(`DELETE /auth/v1/admin/users/${USER}`)
    expect(kidAuthDelete).toBeGreaterThanOrEqual(0)
    expect(classroomDelete).toBeGreaterThanOrEqual(0)
    expect(teacherAuthDelete).toBeGreaterThanOrEqual(0)
    // The FK from class_students.auth_user_id cascades on delete, but the
    // student's OWN books/images/subscriptions do not — those only go away
    // if the student's account is purged through the same purgeUser path.
    expect(kidAuthDelete).toBeLessThan(classroomDelete)
    expect(classroomDelete).toBeLessThan(teacherAuthDelete)
    expect(indexOfCall('submissions?classroom_code=eq.ABC234')).toBeGreaterThanOrEqual(0)
  })

  it('aborts without deleting the teacher when a class purge fails', async () => {
    mockFetch({
      [`classrooms?owner_user_id=eq.${USER}&select=id,code`]: {
        ok: true, status: 200, json: async () => [{ id: 'c1', code: 'ABC234' }], text: async () => '',
      },
      'class_students?classroom_id=eq.c1': {
        ok: true, status: 200, json: async () => [{ auth_user_id: 'kid1' }], text: async () => '',
      },
      // The kid's auth delete fails, so the class purge fails, so the whole
      // purge must abort — the owner FK is RESTRICT, so deleting the teacher
      // here would have failed at the database anyway, but the point is it
      // must never even be attempted while a class is half-purged.
      'auth/v1/admin/users/kid1': { ok: false, status: 500, json: async () => ({}), text: async () => 'boom' },
    })
    const result = await purgeUser(USER, ENV)
    expect(result).toEqual({ ok: false })
    expect(indexOfCall(`/auth/v1/admin/users/${USER}`)).toBe(-1)
  })
})
