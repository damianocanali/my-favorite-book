// Pure helpers behind teacher/family switching (Task D2): see
// src/lib/viewMode.js's own header comment for why these are DOM-free.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getViewMode, setViewMode, isPreviewingKids, enterKidsPreview, exitKidsPreview, computeTeacherMode,
} from '../src/lib/viewMode.js'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('getViewMode', () => {
  it('defaults to teacher when nothing is stored', () => {
    expect(getViewMode()).toBe('teacher')
  })

  it('reads back an explicitly stored family choice', () => {
    localStorage.setItem('mybooklab-view', 'family')
    expect(getViewMode()).toBe('family')
  })

  it('falls back to teacher for any stored value other than "family"', () => {
    localStorage.setItem('mybooklab-view', 'teacher')
    expect(getViewMode()).toBe('teacher')
    localStorage.setItem('mybooklab-view', 'garbage')
    expect(getViewMode()).toBe('teacher')
  })

  it('falls back to teacher when localStorage throws', () => {
    const real = globalThis.localStorage
    globalThis.localStorage = {
      getItem() { throw new Error('blocked') },
    }
    try {
      expect(getViewMode()).toBe('teacher')
    } finally {
      globalThis.localStorage = real
    }
  })
})

describe('setViewMode', () => {
  it('persists a valid mode', () => {
    setViewMode('family')
    expect(localStorage.getItem('mybooklab-view')).toBe('family')
  })

  it('ignores an invalid mode, leaving any existing value untouched', () => {
    setViewMode('family')
    setViewMode('nonsense')
    expect(localStorage.getItem('mybooklab-view')).toBe('family')
  })

  it('never throws when localStorage is blocked', () => {
    const real = globalThis.localStorage
    globalThis.localStorage = {
      setItem() { throw new Error('blocked') },
    }
    try {
      expect(() => setViewMode('family')).not.toThrow()
    } finally {
      globalThis.localStorage = real
    }
  })
})

describe('isPreviewingKids / enterKidsPreview / exitKidsPreview', () => {
  it('is false when nothing is stored', () => {
    expect(isPreviewingKids()).toBe(false)
  })

  it('is true once entered, and false again once exited', () => {
    enterKidsPreview()
    expect(isPreviewingKids()).toBe(true)
    exitKidsPreview()
    expect(isPreviewingKids()).toBe(false)
  })

  it('never throws when sessionStorage is blocked', () => {
    const real = globalThis.sessionStorage
    globalThis.sessionStorage = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
      removeItem() { throw new Error('blocked') },
    }
    try {
      expect(() => enterKidsPreview()).not.toThrow()
      expect(isPreviewingKids()).toBe(false)
      expect(() => exitKidsPreview()).not.toThrow()
    } finally {
      globalThis.sessionStorage = real
    }
  })
})

describe('computeTeacherMode', () => {
  it('is true for a teacher who has not switched to family view', () => {
    expect(computeTeacherMode({ isTeacher: true, viewMode: 'teacher', isStudent: false })).toBe(true)
  })

  it('is false once the teacher switches to family view', () => {
    expect(computeTeacherMode({ isTeacher: true, viewMode: 'family', isStudent: false })).toBe(false)
  })

  it('is false for a non-teacher regardless of viewMode', () => {
    expect(computeTeacherMode({ isTeacher: false, viewMode: 'teacher', isStudent: false })).toBe(false)
  })

  it('is false for a class (student) account even if isTeacher were somehow true', () => {
    expect(computeTeacherMode({ isTeacher: true, viewMode: 'teacher', isStudent: true })).toBe(false)
  })

  it('is false while auth is still loading, even for an otherwise-qualifying teacher', () => {
    expect(computeTeacherMode({ isTeacher: true, viewMode: 'teacher', isStudent: false, loading: true })).toBe(false)
  })

  it('defaults loading to false when the caller omits it', () => {
    expect(computeTeacherMode({ isTeacher: true, viewMode: 'teacher', isStudent: false })).toBe(true)
  })

  it('is false while previewing the kids app, even for an otherwise-qualifying teacher', () => {
    expect(computeTeacherMode({ isTeacher: true, viewMode: 'teacher', isStudent: false, previewingKids: true })).toBe(false)
  })

  it('defaults previewingKids to false when the caller omits it', () => {
    expect(computeTeacherMode({ isTeacher: true, viewMode: 'teacher', isStudent: false })).toBe(true)
  })
})
