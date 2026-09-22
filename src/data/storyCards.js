// Cards for the drag-and-drop story builder.
//
// Every card carries BOTH a picture and a word. That pairing is the point:
// a four-year-old who can't read yet plays entirely by picture, an older
// child reads the word, and the pre-reader picks up the word by seeing it
// under the picture they already recognise. A picture-only card would
// teach nothing; a word-only card would exclude half the audience.
//
// Cards are typed by `kind`, and a slot only accepts its own kind. That is
// deliberate game feedback rather than a restriction — a "place" card
// bouncing off a "who" slot teaches the grammar without a word of
// explanation, and it makes a nonsense sentence impossible to build by
// accident.
//
// `promptEn` on each card is FROZEN ENGLISH. The card's `word` is rendered
// into the child's prose; `promptEn` is joined into page.illustrationHint,
// which lands in the FLUX prompt (src/lib/storyBuilder.js ->
// src/services/imageGenerator.js). The prose must be localised; the prompt
// must not. Translations for `word` live in the `games` namespace, keyed by
// card id: games:cards.<id>.word (hyphens in the id become underscores).
//
// The `word`, `label`, `hint`, `title`, `blurb` and `pages` strings below stay
// in English as the fallback for a locale that has not been authored yet;
// cardWord()/localizedFrame() below are what the UI and the prose renderer
// actually read.
//
// ITALIAN, READ THIS: games:frames.<id>.page_N is a WHOLE SENTENCE with named
// {who}/{what}/{where}/{feeling} placeholders, not a fragment. It may be
// rewritten freely — placeholders reordered, articles moved, a clause dropped
// — as long as every placeholder the English sentence uses still appears.
// games:cards.<id>.word may be a full phrase carrying its own article
// ("un orso", "una vecchia mappa") so the sentence around it needs none.

import i18next from '../i18n/index.js'

/// t() with an English fallback that is safe before i18next is initialised —
/// the unit tests import this module without booting the runtime, and a
/// missing catalogue entry must render English rather than a raw key.
function tr(key, fallback) {
  if (!i18next?.isInitialized || typeof i18next.t !== 'function') return fallback
  return i18next.t(key, { defaultValue: fallback })
}

/// Catalogue key segment for a data id: 'w-bear' -> 'w_bear'.
export const catalogKey = (id) => String(id ?? '').replace(/-/g, '_')

export const CARD_KINDS = {
  who: { label: 'who', emoji: '🙂', hint: 'a character' },
  what: { label: 'what', emoji: '🎁', hint: 'a thing' },
  where: { label: 'where', emoji: '🗺️', hint: 'a place' },
  feeling: { label: 'feeling', emoji: '💛', hint: 'how they felt' },
}

export const STORY_CARDS = [
  // who
  { id: 'w-bear', kind: 'who', word: 'the bear', emoji: '🐻', promptEn: 'the bear' },
  { id: 'w-fox', kind: 'who', word: 'the fox', emoji: '🦊', promptEn: 'the fox' },
  { id: 'w-robot', kind: 'who', word: 'the robot', emoji: '🤖', promptEn: 'the robot' },
  { id: 'w-dragon', kind: 'who', word: 'the dragon', emoji: '🐲', promptEn: 'the dragon' },
  { id: 'w-astronaut', kind: 'who', word: 'the astronaut', emoji: '👩‍🚀', promptEn: 'the astronaut' },
  { id: 'w-owl', kind: 'who', word: 'the owl', emoji: '🦉', promptEn: 'the owl' },

  // what
  { id: 't-key', kind: 'what', word: 'a golden key', emoji: '🔑', promptEn: 'a golden key' },
  { id: 't-map', kind: 'what', word: 'an old map', emoji: '🗺️', promptEn: 'an old map' },
  { id: 't-egg', kind: 'what', word: 'a giant egg', emoji: '🥚', promptEn: 'a giant egg' },
  { id: 't-star', kind: 'what', word: 'a fallen star', emoji: '⭐', promptEn: 'a fallen star' },
  { id: 't-book', kind: 'what', word: 'a talking book', emoji: '📖', promptEn: 'a talking book' },
  { id: 't-cake', kind: 'what', word: 'an enormous cake', emoji: '🎂', promptEn: 'an enormous cake' },

  // where
  { id: 'p-forest', kind: 'where', word: 'the deep forest', emoji: '🌲', promptEn: 'the deep forest' },
  { id: 'p-moon', kind: 'where', word: 'the moon', emoji: '🌙', promptEn: 'the moon' },
  { id: 'p-castle', kind: 'where', word: 'an old castle', emoji: '🏰', promptEn: 'an old castle' },
  { id: 'p-sea', kind: 'where', word: 'under the sea', emoji: '🌊', promptEn: 'under the sea' },
  { id: 'p-cave', kind: 'where', word: 'a dark cave', emoji: '🕳️', promptEn: 'a dark cave' },
  { id: 'p-garden', kind: 'where', word: 'the garden', emoji: '🌻', promptEn: 'the garden' },

  // feeling
  { id: 'f-brave', kind: 'feeling', word: 'brave', emoji: '🦁', promptEn: 'brave' },
  { id: 'f-curious', kind: 'feeling', word: 'curious', emoji: '🔍', promptEn: 'curious' },
  { id: 'f-sleepy', kind: 'feeling', word: 'sleepy', emoji: '😴', promptEn: 'sleepy' },
  { id: 'f-excited', kind: 'feeling', word: 'excited', emoji: '🎉', promptEn: 'excited' },
  { id: 'f-worried', kind: 'feeling', word: 'worried', emoji: '😟', promptEn: 'worried' },
  { id: 'f-proud', kind: 'feeling', word: 'proud', emoji: '🏅', promptEn: 'proud' },
]

// Each page is a sentence with {kind} slots. Slots are addressed per page,
// so the same kind can appear on several pages with different cards —
// the bear on page one need not be the bear on page three.
export const STORY_FRAMES = [
  {
    id: 'discovery',
    title: 'The Big Discovery',
    emoji: '🔍',
    blurb: 'Somebody finds something they were not looking for.',
    pages: [
      'One morning {who} was walking through {where}.',
      'Hidden under the leaves was {what}.',
      '{who} felt {feeling} and picked it up very carefully.',
      'Nothing was ever quite the same again.',
    ],
  },
  {
    id: 'rescue',
    title: 'The Rescue',
    emoji: '🦸',
    blurb: 'Someone needs help. Someone shows up.',
    pages: [
      '{who} heard a small cry coming from {where}.',
      'Stuck in the mud was {what}, and it needed help.',
      'It was hard work, but {who} was {feeling} enough to try.',
      'They walked home together as the sun went down.',
    ],
  },
  {
    id: 'journey',
    title: 'The Long Way Home',
    emoji: '🧭',
    blurb: 'A trip that does not go to plan.',
    pages: [
      '{who} set off for {where} with {what} in a backpack.',
      'The path disappeared, and the sky turned dark.',
      'Feeling {feeling}, {who} kept going anyway.',
      'Home was closer than it had looked all along.',
    ],
  },
]

/// The card face, and the word that goes into the child's prose. NEVER the
/// image prompt — that reads `promptEn` directly (src/lib/storyBuilder.js).
export function cardWord(card) {
  if (!card) return ''
  return tr(`games:cards.${catalogKey(card.id)}.word`, card.word)
}

export const cardKindLabel = (kind) =>
  tr(`games:card_kinds.${kind}.label`, CARD_KINDS[kind]?.label ?? String(kind ?? ''))

export const cardKindHint = (kind) =>
  tr(`games:card_kinds.${kind}.hint`, CARD_KINDS[kind]?.hint ?? '')

/// A frame with its title, blurb and sentences taken from the catalogue.
/// Pass the result — not the raw frame — to src/lib/storyBuilder.js, so the
/// slot parser sees the LOCALISED sentence and an Italian author is free to
/// put {who} wherever Italian wants it.
export function localizedFrame(frame) {
  if (!frame) return frame
  const id = catalogKey(frame.id)
  return {
    ...frame,
    title: tr(`games:frames.${id}.title`, frame.title),
    blurb: tr(`games:frames.${id}.blurb`, frame.blurb),
    pages: (frame.pages ?? []).map((page, i) => tr(`games:frames.${id}.page_${i + 1}`, page)),
  }
}

/// Returns the card with its DISPLAY word localised. `promptEn` rides along
/// untouched, which is what keeps the illustration prompt English.
export const cardById = (id) => {
  const card = STORY_CARDS.find((c) => c.id === id) ?? null
  if (!card) return null
  const word = cardWord(card)
  return word === card.word ? card : { ...card, word }
}

export const cardsOfKind = (kind) => STORY_CARDS.filter((c) => c.kind === kind)
