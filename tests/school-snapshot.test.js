import { describe, it, expect } from 'vitest'
import { snapshotBook, MAX_SNAPSHOT_BYTES } from '../lib/school/snapshot.js'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('snapshotBook', () => {
  it('drops data: URIs on the cover and in nested pages, keeping http(s) URLs', () => {
    const book = {
      title: 'Moon',
      coverImage: PNG,
      pages: [
        { id: 1, text: 'One', illustrationData: 'https://cdn.test/a.png' },
        { id: 2, text: 'Two', illustrationData: PNG, extra: { deep: [PNG, 'http://cdn.test/b.png'] } },
      ],
    }
    const snap = snapshotBook(book)
    expect(snap.coverImage).toBeNull()
    expect(snap.pages[0].illustrationData).toBe('https://cdn.test/a.png')
    expect(snap.pages[1].illustrationData).toBeNull()
    expect(snap.pages[1].extra.deep).toEqual([null, 'http://cdn.test/b.png'])
    expect(snap.title).toBe('Moon')
    expect(JSON.stringify(snap)).not.toContain('data:')
  })

  it('treats data: case-insensitively and with leading whitespace', () => {
    expect(snapshotBook({ a: '  DATA:image/png;base64,xx' }).a).toBeNull()
  })

  it('does not mutate the input', () => {
    const book = { coverImage: PNG, pages: [{ illustrationData: PNG }] }
    snapshotBook(book)
    expect(book.coverImage).toBe(PNG)
    expect(book.pages[0].illustrationData).toBe(PNG)
  })

  it('keeps ordinary strings, numbers, booleans and nulls', () => {
    const book = { title: 'data is fun', n: 3, ok: true, none: null }
    expect(snapshotBook(book)).toEqual(book)
  })

  it('returns null when the stripped book is still over 200 KB', () => {
    expect(MAX_SNAPSHOT_BYTES).toBe(200_000)
    const big = { pages: [{ text: 'x'.repeat(MAX_SNAPSHOT_BYTES + 1) }] }
    expect(snapshotBook(big)).toBeNull()
  })

  it('a book that is huge only because of data URIs fits once they are dropped', () => {
    const heavy = 'data:image/png;base64,' + 'A'.repeat(500_000)
    const snap = snapshotBook({ coverImage: heavy, pages: [{ illustrationData: heavy, text: 'hi' }] })
    expect(snap).toEqual({ coverImage: null, pages: [{ illustrationData: null, text: 'hi' }] })
  })

  it('returns null for a missing or non-object book', () => {
    expect(snapshotBook(null)).toBeNull()
    expect(snapshotBook('book')).toBeNull()
    expect(snapshotBook(undefined)).toBeNull()
  })

  it('measures size in bytes, not UTF-16 code units', () => {
    // 70k three-byte characters = 210 KB of UTF-8 but only 70k .length.
    expect(snapshotBook({ text: '好'.repeat(70_000) })).toBeNull()
  })
})
