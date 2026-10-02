// Review §7 item 20: upstream error bodies are logged short and prompt-free.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { safeDetail } from '../api/_logSafe.js'

describe('safeDetail', () => {
  it('caps at 200 chars', () => {
    expect(safeDetail('x'.repeat(1000))).toHaveLength(200)
  })
  it('cuts an echoed prompt/messages payload', () => {
    const body = '{"error":{"type":"invalid_request","message":"bad"},"messages":[{"role":"user","content":"Mia Rossi age 7 wrote..."}]}'
    const out = safeDetail(body)
    expect(out).toContain('invalid_request')
    expect(out).not.toContain('Mia Rossi')
    expect(safeDetail('{"prompt":"a secret child story"}')).not.toContain('secret')
  })
  it('handles null/undefined', () => {
    expect(safeDetail(undefined)).toBe('')
  })
  it('coins logs the status only', () => {
    expect(readFileSync('api/coins.js', 'utf8')).not.toMatch(/console\.error\('\[coins\] supabase error', res\.status, body\)/)
  })
  it('AI endpoints never log a raw upstream body over 200 chars', () => {
    for (const f of ['api/story-buddy.js', 'api/generate-image.js', 'api/generate-avatar.js', 'api/school/student-avatar.js']) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/detail\.slice\(0, 500\)/)
      expect(src, f).toContain('safeDetail(detail)')
    }
  })
})
