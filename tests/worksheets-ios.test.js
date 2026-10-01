// The worksheet templates live in three places that must agree (same
// approach as tests/grading-tips.test.js):
//   lib/school/worksheets.js                 — what the API accepts
//   src/i18n/locales/{en,it}/school.json      — the web's wording
//   ios-native/.../Models/Worksheets.swift + Views/WorksheetCopy.swift +
//   Localizable.xcstrings                     — the iPad's list and wording
// A box the server accepts but the iPad can't show is an answer a child can
// never give; a prompt the iPad offers but the server refuses is a 400.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  WORKSHEET_TEMPLATES, PROMPT_TEXT_MAX, ANSWER_MAX, ACROSTIC_WORD_MAX, PAGE_TEXT_MAX, BOOK_PAGES_MAX,
} from '../lib/school/worksheets.js'

const model = readFileSync('ios-native/MyBookLab/Models/Worksheets.swift', 'utf8')
const copy = readFileSync('ios-native/MyBookLab/Views/WorksheetCopy.swift', 'utf8')
const catalog = JSON.parse(readFileSync('ios-native/MyBookLab/Localizable.xcstrings', 'utf8')).strings
const en = JSON.parse(readFileSync('src/i18n/locales/en/school.json', 'utf8'))
const itL = JSON.parse(readFileSync('src/i18n/locales/it/school.json', 'utf8'))
const at = (obj, dotted) => dotted.split('.').reduce((o, k) => o?.[k], obj)
const unescape = (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, '\\')

describe('Worksheets.swift ↔ lib', () => {
  it('the same templates, boxes, sizes, page mapping and join, in order', () => {
    const swift = [...model.matchAll(/WorksheetTemplate\(id: "([a-z_]+)", boxes: \[(.*?)\],\s*pages: \[(.*?)\], join: \.([a-z]+)\)/gs)]
      .map(([, id, boxes, pages, join]) => ({
        id,
        boxes: [...boxes.matchAll(/\.init\("([a-z_]+)", \.([a-z]+)(, perLetter: true)?\)/g)]
          .map((m) => ({ id: m[1], size: m[2], ...(m[3] ? { perLetter: true } : {}) })),
        pages: [...pages.matchAll(/\[([^\]]*)\]/g)].map((m) => [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1])),
        join,
      }))
    expect(swift).toEqual(WORKSHEET_TEMPLATES.map((t) => ({ id: t.id, boxes: t.boxes, pages: t.pages, join: t.join })))
  })

  it('the same limits', () => {
    expect(model).toContain(`static let promptMax = ${PROMPT_TEXT_MAX}`)
    expect(model).toContain(`static let answerMax = ${ANSWER_MAX}`)
    expect(model).toContain(`static let acrosticWordMax = ${ACROSTIC_WORD_MAX}`)
    expect(model).toContain(`static let pageTextMax = ${PAGE_TEXT_MAX}`)
    expect(model).toContain(`static let bookPagesMax = ${BOOK_PAGES_MAX}`)
  })

  it('drafts are per child and per assignment, under the web\'s key shape', () => {
    expect(model).toContain('"mbl.worksheetDraft.\\(userId).\\(assignmentId)"')
  })
})

describe('WorksheetCopy ↔ web ↔ catalog', () => {
  it('a title, a description and a default prompt for every template and box', () => {
    for (const t of WORKSHEET_TEMPLATES) {
      expect(copy).toContain(`case "${t.id}": AppText("school.worksheet.templates.${t.id}.title"`)
      expect(copy).toContain(`case "${t.id}": AppText("school.worksheet.templates.${t.id}.description"`)
      for (const b of t.boxes) {
        expect(copy).toContain(`case ("${t.id}", "${b.id}"): AppText("school.worksheet.templates.${t.id}.boxes.${b.id}"`)
      }
    }
  })

  it('every key it uses is in the catalog: EN = code default = web EN, IT = web IT', () => {
    const uses = [...copy.matchAll(/AppText\("(school\.worksheet\.[a-z_.]+)", defaultValue: "((?:[^"\\]|\\.)*)"\)/g)]
    expect(uses.length).toBeGreaterThan(60)
    for (const [, key, def] of uses) {
      const entry = catalog[key]
      expect(entry, key).toBeTruthy()
      const webKey = key.replace(/^school\./, '')
      const fmt = (s) => s.replace(/\{\{number\}\}/g, '%lld').replace(/\{\{\w+\}\}/g, '%@')
      const code = unescape(def).replace(/\\\(number\)/g, '%lld').replace(/\\\(\w+\)/g, '%@')
      expect(entry.localizations.en.stringUnit.value, key).toBe(code)
      expect(entry.localizations.en.stringUnit.value, key).toBe(fmt(at(en, webKey)))
      expect(entry.localizations.it.stringUnit.value, key).toBe(fmt(at(itL, webKey)))
    }
    // Every web worksheet string has its iPad twin.
    const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]))
    const iosKeys = new Set(uses.map((u) => u[1]))
    for (const k of flat(en.worksheet)) expect(iosKeys, k).toContain(`school.worksheet.${k}`)
  })

  it('the new hand-in and teacher error codes have copy on the iPad, matching the web', () => {
    const handIn = readFileSync('ios-native/MyBookLab/Views/HandInPanel.swift', 'utf8')
    for (const code of ['empty_worksheet', 'unkind', 'answer_too_long', 'wrong_kind']) {
      expect(handIn).toContain(`case "${code}":`)
      const key = `school.student.hand_in.errors.${code}`
      expect(catalog[key]?.localizations?.en?.stringUnit?.value).toBe(en.student.hand_in.errors[code])
      expect(catalog[key]?.localizations?.it?.stringUnit?.value).toBe(itL.student.hand_in.errors[code])
    }
    const teacher = readFileSync('ios-native/MyBookLab/Views/Teacher/TeacherCopy.swift', 'utf8')
    expect(teacher).toContain('case "template_locked":')
    expect(catalog['school.teacher.errors.template_locked']?.localizations?.it?.stringUnit?.value).toBe(itL.teacher.errors.template_locked)
  })
})

describe('the iPad flows treat a worksheet as a worksheet', () => {
  const section = readFileSync('ios-native/MyBookLab/Views/StudentAssignmentsView.swift', 'utf8')
  const handIn = readFileSync('ios-native/MyBookLab/Views/HandInPanel.swift', 'utf8')
  const tabs = readFileSync('ios-native/MyBookLab/Views/MainTabView.swift', 'utf8')
  const fill = readFileSync('ios-native/MyBookLab/Views/WorksheetFillView.swift', 'utf8')

  it('the card (and a nudge) opens the fill-in view, never the book draft', () => {
    expect(section).toMatch(/private func startOrContinue\([\s\S]*?\{\n[^\n]*\n\s+if assignment\.isWorksheet \{\n\s+worksheetFor = assignment\n\s+return true/)
    expect(section).toContain('.fullScreenCover(item: $worksheetFor')
  })

  it('a book\'s "Hand in to…" never offers a worksheet assignment (web too)', () => {
    expect(handIn).toContain('.filter { $0.canSubmit && !$0.isWorksheet }')
    expect(readFileSync('src/components/school/HandInPanel.jsx', 'utf8')).toContain("canSubmitTo(a) && a.kind !== 'worksheet'")
  })

  it('the badge counts a worksheet with answers on this iPad as started (web too)', () => {
    expect(tabs).toContain('WorksheetDrafts.hasDraft(userId: userId, assignmentId: a.id)')
    expect(readFileSync('src/stores/useClassBadgeStore.js', 'utf8')).toContain('hasWorksheetDraft(userId, id)')
  })

  it('review round 1: open-draft pages, draft pruning, confirm inside the fill-in view, a11y, UTF-16 limit, class language', () => {
    // I1: pages go into the book open in the editor when it is the one picked.
    expect(model).toMatch(/static func base\(open: Book\?, picked: Book\) -> Book \{\n\s+if let open, open\.id == picked\.id \{ return open \}/)
    expect(section).toContain('WorksheetPages.append(texts, to: WorksheetPages.base(open: draft.book, picked: book))')
    // I3: deleted after a hand-in, pruned on every list load.
    expect(fill).toContain('WorksheetDrafts.remove(userId: userId, assignmentId: assignment.id)')
    expect(section).toContain('WorksheetDrafts.prune(userId: auth.user?.id.uuidString, keeping: fresh)')
    expect(model).toContain('let keep = Set(assignments.filter { $0.status == "published" }.map(\\.id))')
    // I4: the replace-draft question is asked on the fill-in view, after the sheet is gone.
    expect(fill).toContain('.sheet(isPresented: $showPages, onDismiss: afterPagesSheet)')
    expect(fill).toContain('MyAssignmentsSection.hasWork(open), open.id != pick.book?.id')
    expect(section).not.toContain('pendingPages')
    // I5: each answer box is labelled with its prompt.
    expect(fill).toContain('editor(id: id, minHeight: Self.height(size), label: Text(verbatim: prompt))')
    expect(fill).toMatch(/axis: .vertical\) \{ EmptyView\(\) \}\n\s+\.accessibilityLabel\(label\)/)
    // UTF-16 limit with a per-box message; class language; Dynamic Type.
    expect(fill).toContain('text = TeacherStickers.truncated(text, max: max)')
    expect(fill).toContain('WorksheetCopy.studentBoxFull')
    expect(fill).toContain('speaker.toggle(text, language: promptLanguage)')
    expect(fill).not.toMatch(/\.font\(\.system\(size:/)
    // Hand in follows past-due-no-late and waits for a change.
    expect(fill).toContain('assignment.canSubmit && !(assignment.past_due == true && assignment.allow_late == false)')
    expect(fill).toContain('changedSinceHandIn = false')
    // A newer hand-in wins over an older device draft.
    expect(model).toMatch(/submitted > draft\.updatedAt \{\n\s+return \.handedIn/)
  })

  it('the acrostic word field locks once the assignment isn\'t a draft (web too)', () => {
    const picker = readFileSync('ios-native/MyBookLab/Views/Teacher/TeacherWorksheetViews.swift', 'utf8')
    expect(picker).toContain('.disabled(!canChangeTemplate)')
    expect(picker).toContain('canChangeTemplate ? WorksheetCopy.teacherAcrosticWordHint : WorksheetCopy.teacherAcrosticWordLocked')
    const web = readFileSync('src/components/school/WorksheetPicker.jsx', 'utf8')
    expect(web).toContain('disabled={!canChangeTemplate}')
    expect(web).toContain("'school:worksheet.teacher.acrostic_word_locked'")
    expect(readFileSync('src/components/school/AssignmentForm.jsx', 'utf8')).toContain("canChangeTemplate={!isEdit || assignment.status === 'draft'}")
  })

  it('read-aloud per prompt, device autosave, hand-in of the cleaned answers', () => {
    expect(fill).toContain('speaker.toggle(text, language: promptLanguage)')
    expect(fill).toContain('WorksheetDrafts.write(next, userId: userId, assignmentId: assignment.id)')
    expect(fill).toContain('SchoolAssignments.handInWorksheet(\n            assignmentId: assignment.id, answers: WorksheetLayout.answersForSubmit(definition, answers))')
  })
})
