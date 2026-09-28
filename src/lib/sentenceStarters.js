// Sentence starters organized by story position and theme.
// Designed to reduce "blank page anxiety" for ADHD learners by
// providing tap-to-insert scaffolds.
//
// LOCALISATION. Every string here is INSERTED INTO THE CHILD'S PROSE (the
// starters and the word banks) or read aloud to them (the nudges), so it is
// content rather than chrome. The English arrays below are the fallback; the
// catalogue keys are:
//   games:starters.<position>.sN   a starter fragment. The TRAILING SPACE is
//                                  load-bearing — it separates the starter
//                                  from the first word the child types.
//   games:feeling_words.<word>     a feeling, tapped into the sentence.
//   games:action_words.<word>      a past-tense verb, tapped in the same way.
//   games:nudges.nN                a whole idle prompt.
// The key segment is derived from the ENGLISH word, so it stays stable
// whatever the translated value says. An Italian author is free to give a
// feeling or action word a different form (agreement, an auxiliary) — nothing
// here concatenates it with an article.

import i18next from '../i18n/index.js'

/// t() with an English fallback, safe before i18next is initialised.
function tr(key, fallback, vars) {
  if (!i18next?.isInitialized || typeof i18next.t !== 'function') {
    return String(fallback).replace(/\{\{(\w+)\}\}/g, (m, k) => vars?.[k] ?? m)
  }
  return i18next.t(key, { defaultValue: fallback, ...vars })
}

const wordKey = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

const STARTERS_BY_POSITION = {
  opening: [
    'Once upon a time, ',
    'One sunny morning, ',
    'In a land far, far away, ',
    'Long ago, there lived ',
    'It was a dark and stormy night when ',
    'Nobody expected what happened when ',
    'The adventure began when ',
    'Everything changed the day ',
  ],
  middle: [
    'Suddenly, ',
    'Then something amazing happened — ',
    'But there was a problem: ',
    'Just when things seemed hopeless, ',
    'Meanwhile, ',
    'Without warning, ',
    'The next thing they knew, ',
    'That gave them an idea! ',
    'They decided to ',
    'To their surprise, ',
    'After a while, ',
    'Together, they ',
  ],
  ending: [
    'Finally, ',
    'And from that day on, ',
    'In the end, ',
    'They learned that ',
    'And so, ',
    'The best part was ',
    'Everyone cheered because ',
    'And they all lived happily ever after.',
  ],
}

const FEELING_WORDS = [
  'happy', 'excited', 'nervous', 'brave', 'curious',
  'surprised', 'proud', 'worried', 'determined', 'amazed',
]

const ACTION_WORDS = [
  'ran', 'jumped', 'whispered', 'discovered', 'built',
  'flew', 'climbed', 'painted', 'sang', 'explored',
]

const NUDGES = [
  'Need an idea? Try one of the sentence starters above!',
  'What happens next to {{name}}?',
  'How is your character feeling right now?',
  'Try describing what your character can see around them.',
  'What sound does your character hear?',
  'What does {{name}} decide to do?',
  'Close your eyes and imagine the scene — then describe it!',
  'What would YOU do if you were in this story?',
]

const startersFor = (position) =>
  STARTERS_BY_POSITION[position].map((en, i) => tr(`games:starters.${position}.s${i + 1}`, en))

// Default translator for getAllStartersForPosition when no `translate` is
// given: this module's own `tr` against the active app language, same as
// everywhere else in this file. `tr` takes a fully-namespaced key, so this
// is the one place that adds "games:" — see getAllStartersForPosition's own
// comment for why the function itself must NOT do that.
const defaultGamesTranslate = (key, fallback) => tr(`games:${key}`, fallback)

/**
 * Every starter for a story position, in a stable (non-random) order —
 * unlike getPromptsForPage's random subset of 4 for in-editor use, the
 * Sentence starters worksheet (task WS) prints the whole strip.
 *
 * Produces UNPREFIXED keys ("starters.opening.s1", not "games:starters...")
 * — namespacing is entirely the caller's `translate` function's job. Two
 * different callers need this: the worksheet's print path hands in a
 * translator already fixed to the 'games' namespace
 * (i18next.getFixedT(sheetLocale, 'games')), which resolves a bare key
 * directly; the on-screen thumbnail's site-language path instead has a `t`
 * whose default namespace is 'worksheets' and must add "games:" itself to
 * reach this catalogue. A version of this function that added "games:"
 * itself used to silently double that prefix for the second caller
 * ("games:games:starters..."), which never resolves in either language and
 * so always rendered the English fallback regardless of site language —
 * exactly the class of bug a namespace prefix baked into a supposedly
 * reusable key generator invites. `translate` defaults to
 * defaultGamesTranslate (this module's own `tr`, active app language) for
 * any caller that doesn't need a different one.
 */
export function getAllStartersForPosition(position, translate = defaultGamesTranslate) {
  return STARTERS_BY_POSITION[position].map((en, i) => translate(`starters.${position}.s${i + 1}`, en))
}

const feelingWords = () => FEELING_WORDS.map((w) => tr(`games:feeling_words.${wordKey(w)}`, w))
const actionWords = () => ACTION_WORDS.map((w) => tr(`games:action_words.${wordKey(w)}`, w))

/**
 * Returns sentence starters appropriate for the given page position.
 * @param {number} pageNumber - Current page number
 * @param {number} totalPages - Total number of pages
 * @returns {{ starters: string[], feelings: string[], actions: string[] }}
 */
export function getPromptsForPage(pageNumber, totalPages) {
  let position = 'middle'
  if (pageNumber === 1) position = 'opening'
  else if (pageNumber >= totalPages) position = 'ending'

  // Pick 4 random starters from the appropriate position
  const pool = startersFor(position)
  const starters = []
  for (let i = 0; i < Math.min(4, pool.length); i++) {
    const idx = Math.floor(Math.random() * pool.length)
    starters.push(pool.splice(idx, 1)[0])
  }

  return { starters, feelings: feelingWords(), actions: actionWords() }
}

/**
 * Returns a random idle nudge message.
 */
export function getIdleNudge(characterName) {
  const name =
    characterName || tr('games:nudges.default_character', 'your character')
  const i = Math.floor(Math.random() * NUDGES.length)
  return tr(`games:nudges.n${i + 1}`, NUDGES[i], { name })
}
