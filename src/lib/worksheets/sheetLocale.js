// The translators a library sheet is drawn with, in the chosen SHEET
// language (independent of the site's): the worksheets, school (keys carry
// their 'school:' prefix), checkin and games namespaces. One helper for the
// print job AND the Customize live preview, so what is previewed is exactly
// what prints.

export function sheetTranslators(i18n, locale) {
  return {
    t: i18n.getFixedT(locale, 'worksheets'),
    tSchool: i18n.getFixedT(locale),
    tCheckin: i18n.getFixedT(locale, 'checkin'),
    tGames: i18n.getFixedT(locale, 'games'),
  }
}

/// Whether `locale`'s catalogue is in memory (English is bundled; the
/// others are lazy-loaded by i18n/index.js's loadLocale).
export function isSheetLocaleReady(i18n, locale) {
  return locale === 'en' || !!i18n.hasResourceBundle?.(locale, 'worksheets')
}

/// The copy the Customize preview shows: index into the pasted names,
/// clamped (the list can shrink under the pager); -1 = no names, a blank
/// Name line, as printed.
export function previewCopyIndex(names, index) {
  if (!names.length) return -1
  return Math.min(Math.max(0, index), names.length - 1)
}
