// Pure registry for the free /worksheets library (brief §11 / task WS,
// spec 2026-09-26-schools-design.md §11). One source of truth for the 8
// starting templates — the grid page, the print job and the teacher-hook
// deep link (?template=<id>) all read from this rather than growing three
// copies of the same list.
//
// Deliberately just data (id, i18n keys, grade band): no React, no i18next
// call here, so it's trivial to unit test and the actual copy lives in the
// catalogue like everything else (src/i18n/locales/*/worksheets.json).

export const GRADE_BANDS = {
  K2: 'k2',
  G35: 'g35',
}

export const WORKSHEET_TEMPLATES = [
  {
    id: 'story-map',
    titleKey: 'worksheets:templates.story_map.title',
    descriptionKey: 'worksheets:templates.story_map.description',
    gradeBand: GRADE_BANDS.K2,
  },
  {
    id: 'character-profile',
    titleKey: 'worksheets:templates.character_profile.title',
    descriptionKey: 'worksheets:templates.character_profile.description',
    gradeBand: GRADE_BANDS.K2,
  },
  {
    id: 'setting-sketch',
    titleKey: 'worksheets:templates.setting_sketch.title',
    descriptionKey: 'worksheets:templates.setting_sketch.description',
    gradeBand: GRADE_BANDS.K2,
  },
  {
    id: 'storyboard',
    titleKey: 'worksheets:templates.storyboard.title',
    descriptionKey: 'worksheets:templates.storyboard.description',
    gradeBand: GRADE_BANDS.G35,
  },
  {
    id: 'sentence-starters',
    titleKey: 'worksheets:templates.sentence_starters.title',
    descriptionKey: 'worksheets:templates.sentence_starters.description',
    gradeBand: GRADE_BANDS.K2,
  },
  {
    id: 'book-report',
    titleKey: 'worksheets:templates.book_report.title',
    descriptionKey: 'worksheets:templates.book_report.description',
    gradeBand: GRADE_BANDS.G35,
  },
  {
    id: 'feelings-checkin',
    titleKey: 'worksheets:templates.feelings_checkin.title',
    descriptionKey: 'worksheets:templates.feelings_checkin.description',
    gradeBand: GRADE_BANDS.K2,
  },
  {
    id: 'about-author',
    titleKey: 'worksheets:templates.about_author.title',
    descriptionKey: 'worksheets:templates.about_author.description',
    gradeBand: GRADE_BANDS.K2,
  },
]

export function getWorksheetTemplate(id) {
  return WORKSHEET_TEMPLATES.find((t) => t.id === id) ?? null
}
