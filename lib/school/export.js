// The teacher's data export (privacy review §7.4; spec: "Zip/JSON export
// (lapse and year end)"). Pure: takes rows already read and scoped to the
// teacher's own class by api/school/export.js, returns the files of a ZIP.
//
// Per child: profile, their own books (JSON), hand-ins with feedback and
// grades (JSON), grades (CSV), check-ins (CSV — only the last 30 days
// exist, by retention), and "My Writing Year" as JSON plus a simple HTML
// page. No PDFs: rendering needs headless Chromium, which this endpoint
// does not start; the README says how to get one.
import { zipSync, strToU8 } from 'fflate'

export const EXPORT_FORMAT_VERSION = 1

const csvCell = (v) => {
  if (v == null) return ''
  let s = String(v)
  // Spreadsheet formula injection: a cell starting with = + - @ is data.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const toCsv = (header, rows) =>
  [header.join(','), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(','))].join('\r\n') + '\r\n'

/// A folder name that is safe on every OS and still recognisable.
export function safeName(name, id) {
  const base = String(name ?? '').normalize('NFC').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || 'student'
  return `${base}-${String(id ?? '').slice(0, 8)}`
}

const json = (v) => strToU8(JSON.stringify(v, null, 2) + '\n')

function readme({ className, exportedAt, lang, single }) {
  const it = lang === 'it'
  const lines = it
    ? [
        `My Book Lab — esportazione dei dati`,
        `Classe: ${className}`,
        `Creata il: ${exportedAt}`,
        ``,
        single ? `Contiene i dati di un account di classe.` : `Contiene i dati di tutti gli account della classe, una cartella ciascuno.`,
        ``,
        `In ogni cartella:`,
        `  profile.json        nome visualizzato, avatar, stato, date`,
        `  books/*.json        i libri salvati dall'account`,
        `  hand-ins.json       le consegne, con commenti e valutazioni`,
        `  grades.csv          le valutazioni, una riga per versione`,
        `  check-ins.csv       i check-in condivisi (solo gli ultimi 30 giorni: i più vecchi vengono eliminati)`,
        `  writing-year.json   il "Mio anno di scrittura" (dati)`,
        `  writing-year.html   il "Mio anno di scrittura" da aprire nel browser`,
        ``,
        `I PDF non sono inclusi. Per il PDF del "Mio anno di scrittura" usa il pulsante PDF nella sezione della classe.`,
        `Le immagini sono collegamenti: per conservarle, aprile e salvale finché l'account esiste.`,
      ]
    : [
        `My Book Lab — data export`,
        `Class: ${className}`,
        `Exported: ${exportedAt}`,
        ``,
        single ? `This holds one class account's data.` : `This holds every class account's data, one folder each.`,
        ``,
        `In each folder:`,
        `  profile.json        display name, avatar, status, dates`,
        `  books/*.json        the books the account saved`,
        `  hand-ins.json       hand-ins, with feedback and grades`,
        `  grades.csv          grades, one row per graded version`,
        `  check-ins.csv       shared check-ins (the last 30 days only: older ones are deleted)`,
        `  writing-year.json   "My Writing Year" (data)`,
        `  writing-year.html   "My Writing Year" to open in a browser`,
        ``,
        `PDFs are not included. For a "My Writing Year" PDF, use the PDF button in the class's Writing Year section.`,
        `Pictures are links: to keep them, open and save them while the account exists.`,
      ]
  return strToU8(lines.join('\n') + '\n')
}

/**
 * @param {object} p
 * @param {{name, locale, timezone, created_at}} p.classroom
 * @param {Array} p.assignments   assignments rows (id,title,prompt,status,due_at,created_at,kind?)
 * @param {Array} p.students      [{ student, books, handIns, checkins, writingYear: {book, html} }]
 * @param {Date}  p.now
 * @returns {Uint8Array} the ZIP
 */
export function buildExportZip({ classroom, assignments = [], students = [], now = new Date(), single = false }) {
  const root = safeName(classroom.name, '').replace(/-$/, '') || 'class'
  const exportedAt = now.toISOString()
  const files = {}
  const put = (path, data) => { files[`${root}/${path}`] = data }

  put('README.txt', readme({ className: classroom.name, exportedAt, lang: classroom.locale, single }))
  put('class.json', json({
    format_version: EXPORT_FORMAT_VERSION,
    exported_at: exportedAt,
    class: { name: classroom.name, locale: classroom.locale, timezone: classroom.timezone, created_at: classroom.created_at ?? null },
    students: students.map(({ student }) => ({ id: student.id, display_name: student.display_name, folder: safeName(student.display_name, student.id) })),
  }))
  if (!single) put('assignments.json', json(assignments))

  const titles = Object.fromEntries(assignments.map((a) => [a.id, a.title]))
  for (const { student, books = [], handIns = [], checkins = [], writingYear } of students) {
    const dir = safeName(student.display_name, student.id)
    put(`${dir}/profile.json`, json({
      id: student.id,
      display_name: student.display_name,
      avatar_emoji: student.avatar_emoji,
      status: student.status,
      created_at: student.created_at ?? null,
      removed_at: student.removed_at ?? null,
      last_sign_in_at: student.last_sign_in_at ?? null,
    }))
    const usedNames = new Set()
    for (const b of books) {
      let n = safeName(b.title || 'book', b.book_id)
      while (usedNames.has(n)) n += '_'
      usedNames.add(n)
      put(`${dir}/books/${n}.json`, json({ book_id: b.book_id, title: b.title, updated_at: b.updated_at, created_at: b.created_at, book: b.book_data }))
    }
    put(`${dir}/hand-ins.json`, json(handIns.map((h) => ({
      assignment_id: h.assignment_id,
      assignment_title: titles[h.assignment_id] ?? null,
      book_title: h.book_title,
      version: h.version,
      submitted_at: h.submitted_at,
      book: h.book_snapshot,
      feedback: (h.submission_feedback ?? []).map((f) => ({ comment: f.comment, sticker: f.sticker, created_at: f.created_at })),
      grades: (h.submission_grades ?? []).map((g) => ({ version: g.version, level: g.level, tips: g.tips, returned: g.returned, created_at: g.created_at })),
    }))))
    const gradeRows = handIns.flatMap((h) => (h.submission_grades ?? []).map((g) => ({
      assignment: titles[h.assignment_id] ?? '', book_title: h.book_title, version: g.version, level: g.level,
      returned: g.returned ? 'yes' : 'no', graded_at: g.created_at,
    })))
    put(`${dir}/grades.csv`, strToU8(toCsv(['assignment', 'book_title', 'version', 'level', 'returned', 'graded_at'], gradeRows)))
    put(`${dir}/check-ins.csv`, strToU8(toCsv(['created_at', 'feeling', 'need'], checkins)))
    if (writingYear) {
      put(`${dir}/writing-year.json`, json(writingYear.book))
      if (writingYear.html) put(`${dir}/writing-year.html`, strToU8(writingYear.html))
    }
  }
  return zipSync(files, { level: 6, mtime: now })
}
