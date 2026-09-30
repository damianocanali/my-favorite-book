// Owner decision (schools Stage 1): a class (student) account must never
// see the public Gallery of other families' published books. getTabs is the
// pure split TabBar.jsx renders from — pinned here without rendering the
// bar itself (no jsdom in this project's test environment; see
// vitest.config.js).
import { describe, it, expect } from 'vitest'
import { getTabs, badgeText } from '../src/components/layout/TabBar.jsx'
import { classBadgeCount } from '../src/components/school/assignmentStudentUi.js'

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

describe('student Class tab', () => {
  it('relabels a student home as Class and gives it the badge', () => {
    const home = getTabs({ isStudent: true })[0]
    expect(home.to).toBe('/bookshelf')
    expect(home.labelKey).toBe('nav:tabs.class')
    expect(home.badge).toBe('class')
  })

  it('leaves the family Books tab alone', () => {
    const home = getTabs({ isStudent: false })[0]
    expect(home.labelKey).toBe('nav:tabs.books')
    expect(home.badge).toBeUndefined()
  })

  it('shows no bubble at 0 and caps at 9+', () => {
    expect(badgeText(0)).toBeNull()
    expect(badgeText(undefined)).toBeNull()
    expect(badgeText(2)).toBe('2')
    expect(badgeText(12)).toBe('9+')
  })
})

describe('classBadgeCount', () => {
  const a = (id, extra = {}) => ({ id, status: 'published', my_submission: null, ...extra })

  it('counts only open, unopened, unstarted assignments', () => {
    const list = [
      a('new1'),
      a('seen'),
      a('started'),
      a('closed', { status: 'closed' }),
      a('handed', { my_submission: { id: 's', feedback_unseen: 0 } }),
    ]
    const n = classBadgeCount(list, { seen: new Set(['seen']), isStarted: (id) => id === 'started' })
    expect(n).toBe(1)
  })

  it('adds one for an unread nudge', () => {
    expect(classBadgeCount([a('x')], { hasNudge: true })).toBe(2)
    expect(classBadgeCount([], { hasNudge: true })).toBe(1)
    expect(classBadgeCount([], {})).toBe(0)
  })
})
