// The one way the app changes language.
//
// Switching is async because non-English catalogues are lazy-loaded, so
// callers get a `switching` flag to disable the control while it resolves.
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18next, { SUPPORTED_LOCALES, loadLocale, persistLocale, syncDocumentLang } from './index.js'

export const LOCALE_LABELS = {
  en: 'English',
  it: 'Italiano',
}

export function useLocale() {
  const { i18n } = useTranslation()
  const [switching, setSwitching] = useState(false)

  const setLocale = useCallback(async (next) => {
    if (!SUPPORTED_LOCALES.includes(next) || next === i18next.language) return
    setSwitching(true)
    try {
      await loadLocale(next)
      await i18next.changeLanguage(next)
      persistLocale(next)
      syncDocumentLang(next)
    } finally {
      setSwitching(false)
    }
  }, [])

  return {
    locale: i18n.language || 'en',
    setLocale,
    switching,
    supported: SUPPORTED_LOCALES,
    labels: LOCALE_LABELS,
  }
}
