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
  WORKSHEET_TEMPLATES, WORKSHEET_CATEGORIES, GRADE_BANDS, TEMPLATE_ALIASES, getTemplate, resolveTemplateId, matchesGrade,
} from '../../../lib/school/worksheets.js'

export { WORKSHEET_TEMPLATES, WORKSHEET_CATEGORIES, GRADE_BANDS, matchesGrade }

/// The school-namespace key of a template's copy field: 'title',
/// 'description', 'heading', 'keywords', 'picture' or 'boxes.<boxId>'.
export const schoolKey = (templateId, field) => `school:worksheet.templates.${templateId}.${field}`

// The old printable id of each sheet that had one ('beginning_middle_end'
// -> 'story-map').
const OLD_PRINTABLE_ID = Object.fromEntries(Object.entries(TEMPLATE_ALIASES).map(([alias, id]) => [id, alias]))

/// The footer QR's ?ref=worksheet-<ref>: a sheet that was one of the first
/// printables keeps its old id, so analytics don't split; every other sheet
/// uses its id in kebab case — unless that would be an old printable's id
/// (story_map's 'story-map' was the beginning/middle/end sheet's), when it
/// keeps its snake id.
export function qrRef(templateId) {
  const id = resolveTemplateId(templateId) ?? String(templateId)
  if (OLD_PRINTABLE_ID[id]) return OLD_PRINTABLE_ID[id]
  const kebab = id.replace(/_/g, '-')
  return Object.hasOwn(TEMPLATE_ALIASES, kebab) ? id : kebab
}

/// A template by id or old printable alias, or null.
export function getWorksheetTemplate(id) {
  return getTemplate(resolveTemplateId(id))
}
