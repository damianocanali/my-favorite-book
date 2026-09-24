// i18n runtime.
//
// English is statically bundled and is the fallback, so a missing Italian
// key renders English rather than a raw key or an empty node. Other locales
// are lazy-loaded with a dynamic import(), which Vite turns into a separate
// chunk automatically — no http-backend plugin needed.
//
// Detection is hand-rolled rather than using i18next-browser-languagedetector
// so the precedence is explicit and testable.
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en/index.js'

export const SUPPORTED_LOCALES = ['en', 'it']
export const DEFAULT_LOCALE = 'en'
const STORAGE_KEY = 'mybooklab.locale'

export const NAMESPACES = [
  'common', 'nav', 'auth', 'account', 'wizard', 'editor',
  'games', 'gallery', 'print', 'pricing', 'marketing', 'legal',
  'content', 'errors', 'checkin',
]

/// Narrow a full BCP-47 tag ("it-CH") to a locale we ship ("it").
function normalize(tag) {
  if (!tag) return null
  const base = String(tag).toLowerCase().split('-')[0]
  return SUPPORTED_LOCALES.includes(base) ? base : null
}

/// Precedence, highest first:
///   1. ?lang=it            — shareable links, and how QA forces a locale
///   2. saved preference    — the explicit choice always beats the device
///   3. navigator.languages — the device/browser setting, in order
///   4. 'en'
export function resolveLocale() {
  try {
    const q = new URLSearchParams(window.location.search).get('lang')
    const fromQuery = normalize(q)
    if (fromQuery) return fromQuery

    const saved = normalize(window.localStorage?.getItem(STORAGE_KEY))
    if (saved) return saved

    for (const tag of window.navigator?.languages ?? []) {
      const m = normalize(tag)
      if (m) return m
    }
  } catch {
    // Private mode / storage blocked / no window — fall through.
  }
  return DEFAULT_LOCALE
}

export function persistLocale(locale) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, locale)
  } catch {
    // Non-fatal: the choice just won't survive a reload.
  }
}

const loaded = new Set(['en'])

// Explicit per-locale loaders rather than a template-literal import(). A
// template would also match ./locales/en, which is statically imported above
// as the fallback — Rollup then warns and refuses to split it out. Listing
// only the lazy locales keeps English in the main chunk and every other
// locale in its own.
const LAZY_LOADERS = {
  it: () => import('./locales/it/index.js'),
}

/// Pull a locale's namespaces in and register them. Safe to call repeatedly.
export async function loadLocale(locale) {
  if (loaded.has(locale) || !SUPPORTED_LOCALES.includes(locale)) return
  const loader = LAZY_LOADERS[locale]
  if (!loader) return
  const mod = await loader()
  const bundle = mod.default
  for (const ns of NAMESPACES) {
    i18next.addResourceBundle(locale, ns, bundle[ns] ?? {}, true, true)
  }
  loaded.add(locale)
}

/// Keeps <html lang> in step with the active locale. This drives speech
/// synthesis voice selection, screen-reader pronunciation, hyphenation and
/// the browser's offer to translate the page — it is not cosmetic.
export function syncDocumentLang(locale) {
  try {
    document.documentElement.lang = locale
  } catch {
    // no document (tests)
  }
}

export async function bootI18n() {
  const locale = resolveLocale()

  await i18next.use(initReactI18next).init({
    resources: { en },
    lng: 'en',
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    ns: NAMESPACES,
    defaultNS: 'common',
    returnEmptyString: false,
    interpolation: {
      // React escapes for us; double-escaping mangles apostrophes, which
      // Italian elision (l', un', c'era) produces constantly.
      escapeValue: false,
    },
    react: { useSuspense: false },
  })

  if (locale !== 'en') {
    await loadLocale(locale)
    await i18next.changeLanguage(locale)
  }
  syncDocumentLang(locale)
  return i18next
}

export default i18next
