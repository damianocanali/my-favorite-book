// The printable library's view of the ONE worksheet catalogue
// (lib/school/worksheets.js, teacher round 6B): the same 33 templates the
// teacher assigns, so the grid, the print job, the preview and the
// teacher-hook deep link (?template=<id>) never grow their own copy.
//
// Just data and key helpers, no React and no i18next call: the copy lives in
// src/i18n/locales/*/school.json (worksheet.templates.<id>.*), shared with
// the assign picker and mirrored on the iPad.
//
// Old printable ids (kebab-case: 'story-map', 'book-report', …) still
// resolve, as aliases, so printed QR codes and saved links keep working.
import {
  WORKSHEET_TEMPLATES, WORKSHEET_CATEGORIES, GRADE_BANDS, getTemplate, resolveTemplateId, matchesGrade,
} from '../../../lib/school/worksheets.js'

export { WORKSHEET_TEMPLATES, WORKSHEET_CATEGORIES, GRADE_BANDS, matchesGrade }

/// The school-namespace key of a template's copy field: 'title',
/// 'description', 'heading', 'keywords', 'picture' or 'boxes.<boxId>'.
export const schoolKey = (templateId, field) => `school:worksheet.templates.${templateId}.${field}`

/// A template by id or old printable alias, or null.
export function getWorksheetTemplate(id) {
  return getTemplate(resolveTemplateId(id))
}
