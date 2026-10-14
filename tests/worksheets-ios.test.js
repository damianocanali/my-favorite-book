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
  WORKSHEET_CATEGORIES, GRADE_BANDS,
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
    const swift = [...model.matchAll(/WorksheetTemplate\(id: "([a-z_]+)", category: \.([a-z]+), grade: \.([a-z0-9]+),\s*boxes: \[(.*?)\],\s*pages: \[(.*?)\], join: \.([a-z]+)\)/gs)]
      .map(([, id, category, gradeBand, boxes, pages, join]) => ({
        id,
        category,
        gradeBand,
        boxes: [...boxes.matchAll(/\.init\("([a-z_]+)", \.([a-z]+)(, perLetter: true)?\)/g)]
          .map((m) => ({ id: m[1], size: m[2], ...(m[3] ? { perLetter: true } : {}) })),
        pages: [...pages.matchAll(/\[([^\]]*)\]/g)].map((m) => [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1])),
        join,
      }))
    expect(swift).toEqual(WORKSHEET_TEMPLATES.map((t) => ({ id: t.id, category: t.category, gradeBand: t.gradeBand, boxes: t.boxes, pages: t.pages, join: t.join })))
    // The shelves and grade bands, in lib's order.
    expect(model).toContain(`case ${WORKSHEET_CATEGORIES.join(', ')}\n`)
    expect(model).toContain(`enum GradeBand: String, CaseIterable, Sendable { case ${GRADE_BANDS.join(', ')} }`)
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
  it('a title, a description, a heading, keywords, a picture label and a default prompt for every template and box', () => {
    for (const t of WORKSHEET_TEMPLATES) {
      for (const field of ['title', 'description', 'heading', 'keywords', ...(t.print?.picture ? ['picture'] : [])]) {
        expect(copy, `${t.id}.${field}`).toContain(`case "${t.id}": AppText("school.worksheet.templates.${t.id}.${field}"`)
      }
      for (const b of t.boxes) {
        expect(copy).toContain(`case ("${t.id}", "${b.id}"): AppText("school.worksheet.templates.${t.id}.boxes.${b.id}"`)
      }
    }
  })

  it('every key it uses is in the catalog: EN = code default = web EN, IT = web IT', () => {
    const uses = [...copy.matchAll(/AppText\("(school\.worksheet\.[a-z0-9_.]+)", defaultValue: "((?:[^"\\]|\\.)*)"\)/g)]
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
    expect(fill).toContain('private var pastDueLocked: Bool { assignment.past_due == true && assignment.allow_late == false }')
    expect(fill).toContain('assignment.canSubmit && !pastDueLocked')
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

describe('the iPad worksheet library (round 6B)', () => {
  const library = readFileSync('ios-native/MyBookLab/Views/Teacher/TeacherWorksheetLibraryView.swift', 'utf8')
  const picker = readFileSync('ios-native/MyBookLab/Views/Teacher/TeacherWorksheetViews.swift', 'utf8')

  it('the Worksheets tab: search, shelves, grade filter, grouped shelves, teacher cards, iPad-only wide grid', () => {
    expect(library).toContain('.searchable(text: $query, prompt: Text(WorksheetCopy.librarySearchPlaceholder))')
    expect(library).toContain('WorksheetLibraryFilters(category: $category, grade: $grade)')
    expect(library).toContain('ForEach(WorksheetLibrarySearch.grouped(list)) { shelf in')
    expect(library).toContain('WorksheetLibraryEmpty(')
    // The cards (round 7: WorksheetLibraryCard) are teacher cards.
    expect(readFileSync('ios-native/MyBookLab/Views/Teacher/TeacherWorksheetPage.swift', 'utf8')).toMatch(/struct WorksheetLibraryCard: View \{[\s\S]*?TeacherCard \{/)
    expect(library).not.toMatch(/\.white\.opacity\(0\.0[68]\), in: RoundedRectangle/)
    // As before: one column on an iPhone, as many as fit on an iPad.
    expect(library).toContain('GridItem(.adaptive(minimum: 200), spacing: 14)')
    // The preview (round 7: WorksheetPage) keeps its pieces separate for
    // VoiceOver, heading first.
    const page = readFileSync('ios-native/MyBookLab/Views/Teacher/TeacherWorksheetPage.swift', 'utf8')
    expect(page).toContain('.accessibilityElement(children: .contain)')
    expect(page).toMatch(/Text\(WorksheetCopy\.heading\(definition\.templateId\)\)(?:\n[^\n]*){5}\n\s+\.accessibilityAddTraits\(\.isHeader\)/)
  })

  it('search matches the same fields as the web, ignoring case and accents', () => {
    expect(library).toContain('.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)')
    for (const f of ['title', 'description', 'heading', 'category', 'keywords']) expect(library).toContain(`WorksheetCopy.${f}(`)
    expect(library).toContain('words.allSatisfy { hay.contains($0) }')
    expect(model).toContain('return grade == .all || grade == filter')
  })

  it('the preview shows the sheet\'s heading, drawing box and every box; Assign and Print from it', () => {
    expect(library).toContain('WorksheetPageFitted(definition: definition)')
    const page = readFileSync('ios-native/MyBookLab/Views/Teacher/TeacherWorksheetPage.swift', 'utf8')
    expect(page).toContain('Text(WorksheetCopy.heading(definition.templateId))')
    expect(page).toContain('if let p = layout.picture, p.atTop { pictureBlock(picture, min: p.height) }')
    expect(library).toContain('TeacherAssignmentForm(classId: c.id, existing: nil, presetTemplateId: templateId,\n                                  presetWorksheet: custom == nil ? nil : definition)')
    expect(library).toContain('WorksheetPDF.make(title: title, worksheet: definition,')
  })

  it('the assignment form\'s picker has the same search and filters, on teacher cards', () => {
    expect(picker).toContain('WorksheetLibraryFilters(category: $category, grade: $grade)')
    expect(picker).toContain('WorksheetLibrarySearch.filter(query: query, category: category, grade: grade)')
    expect(picker).toContain('TeacherCard {')
  })

  it('editing an assignment whose template this build doesn\'t know edits its own prompts (web too)', () => {
    expect(picker).toContain('if let def = worksheet, def.template != nil || !def.prompts.isEmpty {')
    expect(picker).toContain('def.template?.boxIds ?? def.prompts.keys.sorted()')
    const form = readFileSync('ios-native/MyBookLab/Views/Teacher/TeacherClassesView.swift', 'utf8')
    expect(form).toContain('let ids = TeacherWorksheetPicker.boxIds(def)')
  })

  it('a child\'s fill-in handles every template, and one this build doesn\'t know', () => {
    expect(model).toContain('return def.prompts.keys.sorted().map { .box(id: $0, prompt: def.prompts[$0] ?? "", size: .medium) }')
    const fill = readFileSync('ios-native/MyBookLab/Views/WorksheetFillView.swift', 'utf8')
    expect(fill).toContain('WorksheetLayout.items(definition, childWord: answers?["word"])')
  })
})

describe('iPad round 7: uniform cards with a real page thumbnail', () => {
  const page = readFileSync('ios-native/MyBookLab/Views/Teacher/TeacherWorksheetPage.swift', 'utf8')
  const library = readFileSync('ios-native/MyBookLab/Views/Teacher/TeacherWorksheetLibraryView.swift', 'utf8')
  const picker = readFileSync('ios-native/MyBookLab/Views/Teacher/TeacherWorksheetViews.swift', 'utf8')

  it('the page\'s print hints are lib\'s, template by template', () => {
    const swift = Object.fromEntries([...page.matchAll(/^ {8}"([a-z_]+)": \.init\((.*)\),$/gm)].map(([, id, args]) => {
      const out = {}
      const rows = args.match(/rows: \[(\[.*?\])\](?=, [a-zA-Z]+:|$)/)
      if (rows) out.rows = [...rows[1].matchAll(/\[([^\]]*)\]/g)].map((m) => [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]))
      const dict = (name) => {
        const m = args.match(new RegExp(`${name}: \\[([^\\]]*)\\]`))
        return m ? Object.fromEntries([...m[1].matchAll(/"([a-z_]+)": ([\d.]+)/g)].map((x) => [x[1], Number(x[2])])) : undefined
      }
      if (dict('lines')) out.lines = dict('lines')
      if (dict('drawIn')) out.drawIn = dict('drawIn')
      const pic = args.match(/picture: \.init\(atTop: (true|false), height: ([\d.]+)\)/)
      if (pic) out.picture = { at: pic[1] === 'true' ? 'top' : 'bottom', height: Number(pic[2]) }
      const body = args.match(/body: "([a-z_]+)"/)
      if (body) out.body = body[1]
      return [id, out]
    }))
    expect(swift).toEqual(Object.fromEntries(WORKSHEET_TEMPLATES.map((t) => [t.id, t.print ?? {}])))
  })

  it('a portrait Letter page scaled into a fixed frame, no GeometryReader per card', () => {
    expect(page).toContain('static let size = CGSize(width: 612, height: 792)')
    expect(page).toContain('.scaleEffect(width / WorksheetPage.size.width, anchor: .topLeading)')
    expect(page).not.toContain('GeometryReader {')
    expect(page).toContain('Text(WorksheetCopy.heading(definition.templateId))')
    expect(page).toContain('case "word_web": wordWeb')
    expect(page).toContain('case "feelings_checkin": feelings')
  })

  it('every card the same size: two reserved lines each, the grade pinned to the bottom, in both grids', () => {
    expect(page.match(/\.lineLimit\(2, reservesSpace: true\)/g)).toHaveLength(2)
    expect(page).toMatch(/Spacer\(minLength: 0\)\n\s+Text\(WorksheetCopy\.grade\(template\.grade\)\)/)
    expect(library).toContain('NavigationLink(value: t.id) { WorksheetLibraryCard(template: t) }')
    expect(picker).toContain('WorksheetLibraryCard(template: t, thumbnailWidth: 104, compact: true)')
    expect(library + picker).not.toContain('WorksheetMiniature')
  })
})

describe('round 7: a student\'s worksheet assignment always opens the worksheet', () => {
  const model = readFileSync('ios-native/MyBookLab/Models/StudentAssignment.swift', 'utf8')
  const section = readFileSync('ios-native/MyBookLab/Views/StudentAssignmentsView.swift', 'utf8')
  const fill = readFileSync('ios-native/MyBookLab/Views/WorksheetFillView.swift', 'utf8')

  it('the kind alone routes it (a missing or unreadable definition never sends a child to the book editor)', () => {
    expect(model).toContain('var isWorksheet: Bool { kind == "worksheet" }')
    // An unreadable worksheet is nil, not a failed list that hides every card.
    expect(model).toContain('worksheet = try? c.decodeIfPresent(WorksheetDefinition.self, forKey: .worksheet)')
    // Every key the synthesized decoder read is still read.
    for (const k of ['id', 'title', 'prompt', 'due_at', 'status', 'allow_late', 'created_at', 'past_due', 'my_submission', 'kind', 'class_locale']) {
      expect(model).toContain(`forKey: .${k})`)
    }
  })

  it('every way a child starts it goes through startOrContinue, whose first branch is the worksheet', () => {
    expect(section).toMatch(/private func startOrContinue\([\s\S]*?\{\n[^\n]*\n\s+if assignment\.isWorksheet \{\n\s+worksheetFor = assignment\n\s+return true/)
    // The card's Start / Continue / Hand in again / Try again, and the nudge.
    expect(section).toContain('startOrContinue(assignment)\n                                },')
    expect(section).toContain('if startOrContinue(a, nudge: n) { dismissNudge(n) }')
    expect(section).toContain('onTryAgain: assignment.canTryAgain ? {\n                        feedbackFor = nil\n                        startOrContinue(assignment)')
    // The only place that begins a new book for an assignment is behind it.
    expect(section.match(/draft\.book\?\.assignmentId = assignment\.id/g)).toHaveLength(1)
  })

  it('without a definition the fill-in view says so and offers no hand-in', () => {
    expect(fill).toContain('private var unavailable: Bool { assignment.worksheet == nil }')
    expect(fill).toContain('Text(WorksheetCopy.studentUnavailable)')
    expect(fill).toContain('private var canSubmit: Bool { !unavailable && assignment.canSubmit')
    expect(catalog['school.worksheet.student.unavailable'].localizations.it.stringUnit.value).toBe(
      itL.worksheet.student.unavailable)
    expect(catalog['school.worksheet.student.unavailable'].localizations.en.stringUnit.value).toBe(
      en.worksheet.student.unavailable)
  })
})

describe('round 7 fix round 1 (iPad)', () => {
  const fill = readFileSync('ios-native/MyBookLab/Views/WorksheetFillView.swift', 'utf8')
  it('unavailable: no "saved on this iPad", no load error; past due without late work: read-only with the past-due copy', () => {
    expect(fill).toContain('if loadFailed, !unavailable {')
    expect(fill).toMatch(/if pastDueLocked, !unavailable \{\n\s+Text\(HandInCopy\.error\("past_due"\)\)[^\n]*\n\s+\} else if !unavailable \{\n\s+Label \{ Text\(WorksheetCopy\.studentSavedHere\) \}/)
    expect(fill.match(/\.disabled\(pastDueLocked\)/g)).toHaveLength(2)
    expect(fill).toContain('guard !pastDueLocked else { return }')
  })
})
