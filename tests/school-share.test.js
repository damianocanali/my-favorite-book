import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/lib/api', () => ({ apiFetchAuthed: vi.fn(async () => new Response(JSON.stringify({ id: 'h1', in_hours: true }))) }))

const student = { id: 'u', app_metadata: { role: 'student' } }
const parent = { id: 'p', app_metadata: {}, user_metadata: { role: 'student' } }

describe('schoolShare', () => {
  beforeEach(async () => { (await import('../src/lib/api')).apiFetchAuthed.mockClear() })

  it('never sends a consumer check-in, even with a spoofed user_metadata role', async () => {
    const { shareCheckIn } = await import('../src/lib/schoolShare.js')
    const { apiFetchAuthed } = await import('../src/lib/api')
    expect(await shareCheckIn({ feeling: 'sad', need: 'quiet' }, parent)).toBe(false)
    expect(await shareCheckIn({ feeling: 'sad' }, null)).toBe(false)
    expect(apiFetchAuthed).not.toHaveBeenCalled()
  })

  it('sends only feeling and need for a student', async () => {
    const { shareCheckIn } = await import('../src/lib/schoolShare.js')
    const { apiFetchAuthed } = await import('../src/lib/api')
    expect(await shareCheckIn({ feeling: 'sad', need: 'grownup', at: 123, extra: 'x' }, student)).toBe(true)
    const [path, init] = apiFetchAuthed.mock.calls[0]
    expect(path).toBe('/api/school/checkin')
    expect(JSON.parse(init.body)).toEqual({ feeling: 'sad', need: 'grownup' })
  })

  it('askForHelp reports in-hours for a student and does nothing for a consumer', async () => {
    const { askForHelp } = await import('../src/lib/schoolShare.js')
    expect(await askForHelp('grownup', student)).toEqual({ ok: true, id: 'h1', inHours: true })
    expect((await askForHelp('grownup', parent)).ok).toBe(false)
  })

  it('askForHelp resolves { ok: false } when the request times out (AbortError), rather than hanging or throwing', async () => {
    const { apiFetchAuthed } = await import('../src/lib/api')
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    apiFetchAuthed.mockImplementationOnce(async () => { throw abortError })

    const { askForHelp } = await import('../src/lib/schoolShare.js')
    await expect(askForHelp('grownup', student)).resolves.toEqual({ ok: false })
  })

  it('shareCheckIn resolves false (never rejects) when the request times out (AbortError)', async () => {
    const { apiFetchAuthed } = await import('../src/lib/api')
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    apiFetchAuthed.mockImplementationOnce(async () => { throw abortError })

    const { shareCheckIn } = await import('../src/lib/schoolShare.js')
    await expect(shareCheckIn({ feeling: 'sad' }, student)).resolves.toBe(false)
  })
})
