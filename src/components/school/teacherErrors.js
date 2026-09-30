// Maps a server error `code` (see api/school/{classes,students}.js and the
// brief's error list) to the i18n key under `school:teacher.errors.*` to
// render it with. The mapping itself is pure and i18n-free — no react-
// i18next dependency — so it's unit-testable directly; callers translate
// the returned key with their own `t`.
//
// `duplicate_name` and `create_failed` read as short fragments ("already in
// this class", "couldn't be created") when AddStudents composes them into
// its per-name "{{name}} — {{reason}}" skipped line. But the exact same
// codes also come back as a STANDALONE error elsewhere — e.g. renaming a
// student to a name another student already has
// (api/school/students.js's `rename` action returns `duplicate_name` as
// the whole response's error, not a per-item skip). A fragment read alone
// ("already in this class.") doesn't parse as a sentence, so standalone
// callers get the `_full` full-sentence variant instead.
const FRAGMENT_CODES = new Set(['duplicate_name', 'create_failed'])

// Codes with their own sentence under school:teacher.errors.* (a code not
// listed here and without a key falls back to `generic`). class_archived:
// api/school/nudges.js refuses to nudge an archived class.
export const KNOWN_CODES = ['class_archived']

export function errorKeyFor(code, { standalone = true } = {}) {
  if (standalone && FRAGMENT_CODES.has(code)) return `${code}_full`
  return code
}

export function teacherErrorText(t, code, opts) {
  const key = errorKeyFor(code, opts)
  return t(`school:teacher.errors.${key}`, { defaultValue: t('school:teacher.errors.generic') })
}
