// `promptEn` is FROZEN ENGLISH and must never be translated or localised.
// It is concatenated into the FLUX image prompt (src/services/imageGenerator.js),
// and those models are trained overwhelmingly on English captions — an Italian
// prompt term measurably degrades the illustration.
//
// The `name`/`label`/`description` fields below are the English DISPLAY text and
// the fallback for books saved before the split. Translations live in
// src/i18n/locales/<locale>/content.json, keyed by the entry's `id`.
export const timePeriods = [
  {
    id: 'past',
    promptEn: { label: 'Long, Long Ago' },
    label: 'Long, Long Ago',
    emoji: '🏛️',
    description: 'In ancient times with castles, knights, and legends',
    color: '#D97706',
  },
  {
    id: 'present',
    promptEn: { label: 'Right Now' },
    label: 'Right Now',
    emoji: '🌍',
    description: 'In today\'s world, just like where we live',
    color: '#22C55E',
  },
  {
    id: 'future',
    promptEn: { label: 'The Future' },
    label: 'The Future',
    emoji: '🔮',
    description: 'In a world of amazing technology and discoveries',
    color: '#06B6D4',
  },
  {
    id: 'fantasy',
    promptEn: { label: 'A Magical Realm' },
    label: 'A Magical Realm',
    emoji: '✨',
    description: 'In a world where anything is possible and magic is real',
    color: '#A855F7',
  },
]
