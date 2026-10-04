// "Assign a worksheet" from the printable library walks the teacher to a
// class and opens New assignment on "A worksheet" (owner feedback round 5).
import { describe, it, expect } from 'vitest'
import { assignIntent, classHref, ASSIGN_WORKSHEET_HREF } from '../src/components/school/assignIntent.js'
import { getTabs } from '../src/components/layout/TabBar.jsx'

describe('assignIntent', () => {
  it('reads ?assign=worksheet', () => {
    expect(assignIntent(new URLSearchParams('assign=worksheet'))).toBe('worksheet')
  })
  it('ignores anything else', () => {
    expect(assignIntent(new URLSearchParams(''))).toBeNull()
    expect(assignIntent(new URLSearchParams('assign=book'))).toBeNull()
    expect(assignIntent(null)).toBeNull()
  })
})

describe('classHref', () => {
  it('keeps the intent on the class link', () => {
    expect(classHref('c1', 'worksheet')).toBe('/teacher/class/c1?assign=worksheet')
  })
  it('is the plain class link otherwise', () => {
    expect(classHref('c1')).toBe('/teacher/class/c1')
    expect(classHref('c1', 'nope')).toBe('/teacher/class/c1')
  })
  it('the library link goes to the class list with the intent', () => {
    expect(ASSIGN_WORKSHEET_HREF).toBe('/teacher/classes?assign=worksheet')
  })
})

describe('teacher Worksheets tab', () => {
  it('sits between Classes and Account and only lights up on /worksheets', () => {
    const tab = getTabs({ teacherMode: true }).find((x) => x.to === '/worksheets')
    expect(tab.labelKey).toBe('nav:tabs.worksheets')
    expect(tab.match('/worksheets')).toBe(true)
    expect(tab.match('/teacher')).toBe(false)
  })
  it('is not in the family or student tab bars', () => {
    expect(getTabs({}).some((x) => x.to === '/worksheets')).toBe(false)
    expect(getTabs({ isStudent: true }).some((x) => x.to === '/worksheets')).toBe(false)
  })
})
