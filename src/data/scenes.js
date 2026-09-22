// `promptEn` is FROZEN ENGLISH and must never be translated or localised.
// It is concatenated into the FLUX image prompt (src/services/imageGenerator.js),
// and those models are trained overwhelmingly on English captions — an Italian
// prompt term measurably degrades the illustration.
//
// The `name`/`label`/`description` fields below are the English DISPLAY text and
// the fallback for books saved before the split. Translations live in
// src/i18n/locales/<locale>/content.json, keyed by the entry's `id`.
export const scenes = [
  {
    id: 'enchanted-forest',
    promptEn: { name: 'Enchanted Forest', description: 'A magical forest filled with glowing trees and hidden paths' },
    name: 'Enchanted Forest',
    emoji: '🌳',
    description: 'A magical forest filled with glowing trees and hidden paths',
    color: '#22C55E',
    gradient: 'from-green-900 to-emerald-700',
  },
  {
    id: 'outer-space',
    promptEn: { name: 'Outer Space', description: 'The infinite cosmos with stars, planets, and nebulas' },
    name: 'Outer Space',
    emoji: '🚀',
    description: 'The infinite cosmos with stars, planets, and nebulas',
    color: '#6366F1',
    gradient: 'from-indigo-900 to-purple-900',
  },
  {
    id: 'underwater',
    promptEn: { name: 'Deep Ocean', description: 'A colorful underwater world with coral reefs and sea creatures' },
    name: 'Deep Ocean',
    emoji: '🌊',
    description: 'A colorful underwater world with coral reefs and sea creatures',
    color: '#0EA5E9',
    gradient: 'from-blue-900 to-cyan-700',
  },
  {
    id: 'castle',
    promptEn: { name: 'Royal Castle', description: 'A grand castle with tall towers and secret passages' },
    name: 'Royal Castle',
    emoji: '🏰',
    description: 'A grand castle with tall towers and secret passages',
    color: '#A855F7',
    gradient: 'from-purple-900 to-pink-800',
  },
  {
    id: 'future-city',
    promptEn: { name: 'Future City', description: 'A city of flying cars, holograms, and towering skyscrapers' },
    name: 'Future City',
    emoji: '🌆',
    description: 'A city of flying cars, holograms, and towering skyscrapers',
    color: '#06B6D4',
    gradient: 'from-slate-900 to-cyan-900',
  },
  {
    id: 'pirate-ship',
    promptEn: { name: 'Pirate Ship', description: 'A mighty ship sailing through stormy seas and treasure islands' },
    name: 'Pirate Ship',
    emoji: '⛵',
    description: 'A mighty ship sailing through stormy seas and treasure islands',
    color: '#D97706',
    gradient: 'from-amber-900 to-orange-800',
  },
  {
    id: 'candy-land',
    promptEn: { name: 'Candy Land', description: 'A sweet world made of chocolate rivers and candy mountains' },
    name: 'Candy Land',
    emoji: '🍭',
    description: 'A sweet world made of chocolate rivers and candy mountains',
    color: '#EC4899',
    gradient: 'from-pink-800 to-rose-700',
  },
  {
    id: 'dinosaur-valley',
    promptEn: { name: 'Dinosaur Valley', description: 'A prehistoric valley where dinosaurs still roam free' },
    name: 'Dinosaur Valley',
    emoji: '🦕',
    description: 'A prehistoric valley where dinosaurs still roam free',
    color: '#65A30D',
    gradient: 'from-lime-900 to-green-800',
  },
]
