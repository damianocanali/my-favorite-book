// Regression test for a real bug (review round 1): the Sentence starters
// worksheet thumbnail always rendered English on the site, in ANY site
// language, because getAllStartersForPosition used to bake its own
// "games:" prefix into the key it built, and WorksheetsPage's site-language
// wrapper (tGamesSite) ALSO adds "games:" — the two together produced
// "games:games:starters.opening.s1", which resolves in neither language, so
// i18next always fell through to the English `fallback` argument. Fixed by
// having getAllStartersForPosition produce unprefixed keys and pushing all
// namespacing onto the caller's translator (src/lib/sentenceStarters.js).
//
// Exercises this with a REAL i18next instance carrying the actual English
// and Italian `games.json` catalogues — a fake/mocked translator would not
// have caught the double-prefix bug, since the bug only manifests through
// real key resolution against real resources.
import { describe, it, expect } from 'vitest'
import i18next from 'i18next'
import en from '../src/i18n/locales/en/index.js'
import itLocale from '../src/i18n/locales/it/index.js'
import { getAllStartersForPosition } from '../src/lib/sentenceStarters.js'

async function makeInstance() {
  const instance = i18next.createInstance()
  await instance.init({
    resources: { en, it: itLocale },
    lng: 'en',
    fallbackLng: 'en',
    ns: ['games', 'worksheets'],
    defaultNS: 'worksheets',
    interpolation: { escapeValue: false },
  })
  return instance
}

describe('getAllStartersForPosition — site-language translator (Italian)', () => {
  it('yields Italian starters, not the English fallback, through a translator shaped like WorksheetsPage\'s site-language wrapper', async () => {
    const instance = await makeInstance()
    // Mirrors WorksheetsPage's tGamesSite exactly: a `t` whose default
    // namespace is 'worksheets' (this instance's defaultNS), fixed to
    // Italian, that adds the "games:" prefix itself — getAllStartersForPosition
    // must hand it an UNPREFIXED key for this to resolve correctly.
    const tSite = instance.getFixedT('it')
    const tGamesSite = (key, opts) => tSite(`games:${key}`, opts)

    const starters = getAllStartersForPosition('opening', tGamesSite)

    expect(starters[0]).toBe("C'era una volta ")
    expect(starters[0]).not.toBe('Once upon a time, ')
    // Every starter for this position actually resolved from the Italian
    // catalogue (none silently fell back to its English default value).
    const enStarters = getAllStartersForPosition('opening', (key, fallback) => fallback)
    expect(starters).not.toEqual(enStarters)
  })

  it('the print path (a translator already fixed to the games namespace) still resolves Italian directly', async () => {
    const instance = await makeInstance()
    // Mirrors WorksheetsPage's print-job translator:
    // i18next.getFixedT(sheetLocale, 'games') — already scoped to 'games',
    // so it must receive the bare key as-is with no further prefixing.
    const tGamesFixed = instance.getFixedT('it', 'games')
    const starters = getAllStartersForPosition('opening', tGamesFixed)
    expect(starters[0]).toBe("C'era una volta ")
  })

  it('defaults to English starters unprefixed when called with no translator (module not yet i18n-initialised)', () => {
    const starters = getAllStartersForPosition('opening')
    expect(starters[0]).toBe('Once upon a time, ')
  })
})
