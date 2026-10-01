// Pure helpers behind grading with tips on the web (teacher GradePanel,
// the review list's level chips, the CSV export, and the child's level and
// tips). i18n-free and DOM-free like assignmentUi.js, so they're unit-tested
// directly; the rules themselves come from lib/school/grading.js, the same
// module the API validates with.
import { LEVELS, SKILLS, TIP_SKILLS, TIP_KEYS, TIPS_MAX, TIP_TEXT_MAX, toCsv, csvFilename } from '../../../lib/school/grading.js'

export { LEVELS, SKILLS, TIP_SKILLS, TIPS_MAX, TIP_TEXT_MAX, csvFilename }

// A growing plant, then a star: friendly, never a score (iPad:
// GradingRules.emoji).
export const LEVEL_EMOJI = { getting_started: '🌱', growing: '🌿', got_it: '🌳', wow: '🌟' }

// Soft and warm, never red: a level is encouragement, not a mark.
export const LEVEL_TONE = {
  getting_started: 'bg-lime-400/15 border-lime-300/40',
  growing: 'bg-emerald-400/15 border-emerald-300/40',
  got_it: 'bg-sky-400/15 border-sky-300/40',
  wow: 'bg-amber-300/20 border-amber-300/50',
}

/// A tip as the reader sees it: a library tip through `t` (the reader's
/// language), a custom one exactly as written. null for a library key this
/// build doesn't know (a newer server) — callers skip it.
export function tipLabel(t, tip) {
  if (tip && typeof tip.key === 'string') return TIP_KEYS.includes(tip.key) ? t(`school:grading.tips.${tip.key}`) : null
  if (tip && typeof tip.text === 'string' && tip.text) return tip.text
  return null
}

/// Same-version re-grade replaces; returns the history newest first.
export function mergeGrade(grades, grade) {
  return [...(grades ?? []).filter((g) => g.version !== grade.version), grade].sort((a, b) => b.version - a.version)
}

/// What the review row says next to the level: 'sent_back' while waiting on
/// the child, 'new_version' once they handed in again since the last grade.
export function gradeRowFlag(row) {
  if (!row || row.status !== 'handed_in') return null
  if (row.returned) return 'sent_back'
  if (row.graded_version != null && row.version > row.graded_version) return 'new_version'
  return null
}

/// What the teacher's Save does locally before asking the server. Returns
/// null when it may go, else the i18n key of the reason.
export function gradeProblem({ level, tips, returned }) {
  if (!LEVELS.includes(level)) return 'school:grading.teacher.need_level'
  if (returned && !(tips?.length)) return 'school:grading.teacher.need_tip'
  return null
}

/// The CSV for GET /api/school/grades?classId=… rows: student name,
/// assignment, level, version, date, sent back — headers and level names in
/// the teacher's language; every cell escaped against formula injection.
export function gradesCsv(t, rows) {
  // ISO day (2026-10-01): unambiguous in both languages, and spreadsheets
  // read it as a date.
  const date = (iso) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
  }
  return toCsv([
    [
      t('school:grading.teacher.csv_student'), t('school:grading.teacher.csv_assignment'), t('school:grading.teacher.csv_level'),
      t('school:grading.teacher.csv_version'), t('school:grading.teacher.csv_date'), t('school:grading.teacher.csv_sent_back'),
    ],
    ...(rows ?? []).map((r) => [
      r.display_name ?? '',
      r.assignment_title ?? '',
      LEVELS.includes(r.level) ? t(`school:grading.levels.${r.level}`) : '',
      r.version,
      date(r.graded_at),
      r.returned ? t('school:grading.teacher.csv_yes') : t('school:grading.teacher.csv_no'),
    ]),
  ])
}
