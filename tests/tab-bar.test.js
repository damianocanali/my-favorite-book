// Owner decision (schools Stage 1): a class (student) account must never
// see the public Gallery of other families' published books. getTabs is the
// pure split TabBar.jsx renders from — pinned here without rendering the
// bar itself (no jsdom in this project's test environment; see
// vitest.config.js).
import { describe, it, expect } from 'vitest'
import { getTabs } from '../src/components/layout/TabBar.jsx'

describe('getTabs', () => {
  it('gives a consumer account the gallery tab', () => {
    const tabs = getTabs({ isStudent: false })
    expect(tabs.some((tab) => tab.to === '/gallery')).toBe(true)
  })

  it('never gives a student account the gallery tab', () => {
    const tabs = getTabs({ isStudent: true })
    expect(tabs.some((tab) => tab.to === '/gallery')).toBe(false)
  })

  it('still hides orders (pre-existing) alongside gallery for a student', () => {
    const tabs = getTabs({ isStudent: true })
    expect(tabs.some((tab) => tab.to === '/orders')).toBe(false)
    expect(tabs.map((tab) => tab.to)).toEqual(['/bookshelf', '/create', '/account'])
  })

  it('teacher mode is unaffected by isStudent', () => {
    const tabs = getTabs({ teacherMode: true, isStudent: true })
    expect(tabs.map((tab) => tab.to)).toEqual(['/teacher', '/teacher/classes', '/account'])
  })
})
