// Pure helpers behind the web's grading UI (src/components/school/
// gradingUi.js) and the child's card state (assignmentStudentUi.js).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { tipLabel, mergeGrade, gradeRowFlag, gradeProblem, gradesCsv, LEVEL_EMOJI, LEVELS } from '../src/components/school/gradingUi.js'
import { hasUnseenFeedback, isSentBack } from '../src/components/school/assignmentStudentUi.js'

const en = JSON.parse(readFileSync('src/i18n/locales/en/school.json', 'utf8'))
const itL = JSON.parse(readFileSync('src/i18n/locales/it/school.json', 'utf8'))
const tFor = (cat) => (key) => key.replace(/^school:/, '').split('.').reduce((o, k) => o?.[k], cat) ?? key
const t = tFor(en)

describe('gradingUi', () => {
  it('tipLabel: library tips through t, custom text verbatim, unknown keys skipped', () => {
    expect(tipLabel(t, { key: 'ideas.why' })).toBe(en.grading.tips.ideas.why)
    expect(tipLabel(tFor(itL), { key: 'ideas.why' })).toBe(itL.grading.tips.ideas.why)
    expect(tipLabel(t, { text: 'school:grading.levels.wow' })).toBe('school:grading.levels.wow')
    expect(tipLabel(t, { key: 'ideas.robots' })).toBeNull()
    expect(tipLabel(t, {})).toBeNull()
  })

  it('every level has an emoji', () => {
    for (const l of LEVELS) expect(LEVEL_EMOJI[l]).toBeTruthy()
  })

  it('mergeGrade replaces the same version and keeps newest first', () => {
    const merged = mergeGrade([{ version: 2, level: 'growing' }, { version: 1, level: 'growing' }], { version: 2, level: 'wow' })
    expect(merged).toEqual([{ version: 2, level: 'wow' }, { version: 1, level: 'growing' }])
    expect(mergeGrade(undefined, { version: 1 })).toEqual([{ version: 1 }])
  })

  it('gradeRowFlag: sent back wins, then a newer version than the graded one', () => {
    expect(gradeRowFlag({ status: 'handed_in', returned: true, version: 1, graded_version: 1 })).toBe('sent_back')
    expect(gradeRowFlag({ status: 'handed_in', returned: false, version: 2, graded_version: 1 })).toBe('new_version')
    expect(gradeRowFlag({ status: 'handed_in', returned: false, version: 2, graded_version: 2 })).toBeNull()
    expect(gradeRowFlag({ status: 'handed_in', version: 1, graded_version: null })).toBeNull()
    expect(gradeRowFlag({ status: 'not_started' })).toBeNull()
  })

  it('gradeProblem mirrors the API: a level always, a tip when sending back', () => {
    expect(gradeProblem({ level: null, tips: [] })).toBe('school:grading.teacher.need_level')
    expect(gradeProblem({ level: 'wow', tips: [], returned: true })).toBe('school:grading.teacher.need_tip')
    expect(gradeProblem({ level: 'wow', tips: [], returned: false })).toBeNull()
    expect(gradeProblem({ level: 'growing', tips: [{ key: 'ideas.why' }], returned: true })).toBeNull()
  })

  it('gradesCsv: translated headers and levels, ISO dates, injection-safe names', () => {
    const csv = gradesCsv(tFor(itL), [
      { display_name: '=HYPERLINK("x")', assignment_title: 'Il mio "drago"', level: 'got_it', version: 2, graded_at: '2026-10-01T15:00:00.000Z', returned: true },
    ])
    const lines = csv.replace(/^﻿/, '').trim().split('\r\n')
    expect(lines[0]).toBe('"Nome","Compito","Livello","Versione","Data","Da rivedere"')
    expect(lines[1]).toBe('"\'=HYPERLINK(""x"")","Il mio ""drago""","Ci sei!","2","2026-10-01","sì"')
  })
})

describe('assignmentStudentUi grading state', () => {
  const a = (sub, status = 'published') => ({ status, my_submission: sub })

  it('a new grade counts as new feedback', () => {
    expect(hasUnseenFeedback(a({ feedback_unseen: 0, grade_unseen: true }))).toBe(true)
    expect(hasUnseenFeedback(a({ feedback_unseen: 0, grade_unseen: false }))).toBe(false)
  })

  it('isSentBack only while the child can still hand in again', () => {
    expect(isSentBack(a({ returned: true }))).toBe(true)
    expect(isSentBack(a({ returned: true }, 'closed'))).toBe(false)
    expect(isSentBack(a({ returned: false }))).toBe(false)
    expect(isSentBack(a(null))).toBe(false)
  })
})
