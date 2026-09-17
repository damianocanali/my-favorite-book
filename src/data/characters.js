// `promptEn` is FROZEN ENGLISH and must never be translated or localised.
// It is concatenated into the FLUX image prompt (src/services/imageGenerator.js),
// and those models are trained overwhelmingly on English captions — an Italian
// prompt term measurably degrades the illustration.
//
// The `name`/`label`/`description` fields below are the English DISPLAY text and
// the fallback for books saved before the split. Translations live in
// src/i18n/locales/<locale>/content.json, keyed by the entry's `id`.
export const characters = [
  {
    id: 'astronaut',
    promptEn: { name: 'Astro the Explorer', description: 'A brave space explorer who discovers new planets' },
    name: 'Astro the Explorer',
    emoji: '👨‍🚀',
    description: 'A brave space explorer who discovers new planets',
    color: '#8B5CF6',
  },
  {
    id: 'princess',
    promptEn: { name: 'Princess Luna', description: 'A magical princess who rules the moonlight kingdom' },
    name: 'Princess Luna',
    emoji: '👸',
    description: 'A magical princess who rules the moonlight kingdom',
    color: '#F472B6',
  },
  {
    id: 'dragon',
    promptEn: { name: 'Spark the Dragon', description: 'A friendly dragon who breathes colorful fire' },
    name: 'Spark the Dragon',
    emoji: '🐉',
    description: 'A friendly dragon who breathes colorful fire',
    color: '#F97316',
  },
  {
    id: 'robot',
    promptEn: { name: 'Beeper Bot', description: 'A clever robot who loves solving puzzles' },
    name: 'Beeper Bot',
    emoji: '🤖',
    description: 'A clever robot who loves solving puzzles',
    color: '#06B6D4',
  },
  {
    id: 'pirate',
    promptEn: { name: 'Captain Waves', description: 'A fearless pirate sailing the seven seas' },
    name: 'Captain Waves',
    emoji: '🏴‍☠️',
    description: 'A fearless pirate sailing the seven seas',
    color: '#EAB308',
  },
  {
    id: 'unicorn',
    promptEn: { name: 'Shimmer', description: 'A magical unicorn with a rainbow mane' },
    name: 'Shimmer',
    emoji: '🦄',
    description: 'A magical unicorn with a rainbow mane',
    color: '#D946EF',
  },
  {
    id: 'wizard',
    promptEn: { name: 'Merlo the Wise', description: 'An ancient wizard with powerful spells' },
    name: 'Merlo the Wise',
    emoji: '🧙',
    description: 'An ancient wizard with powerful spells',
    color: '#6366F1',
  },
  {
    id: 'fairy',
    promptEn: { name: 'Twinkle', description: 'A tiny fairy who grants wishes' },
    name: 'Twinkle',
    emoji: '🧚',
    description: 'A tiny fairy who grants wishes',
    color: '#34D399',
  },
  {
    id: 'ninja',
    promptEn: { name: 'Shadow', description: 'A stealthy ninja with incredible speed' },
    name: 'Shadow',
    emoji: '🥷',
    description: 'A stealthy ninja with incredible speed',
    color: '#475569',
  },
  {
    id: 'mermaid',
    promptEn: { name: 'Coral', description: 'A mermaid who sings to the ocean creatures' },
    name: 'Coral',
    emoji: '🧜‍♀️',
    description: 'A mermaid who sings to the ocean creatures',
    color: '#22D3EE',
  },
  {
    id: 'superhero',
    promptEn: { name: 'Captain Blaze', description: 'A superhero with the power of the sun' },
    name: 'Captain Blaze',
    emoji: '🦸',
    description: 'A superhero with the power of the sun',
    color: '#EF4444',
  },
  {
    id: 'alien',
    promptEn: { name: 'Zorp', description: 'A friendly alien from the Andromeda galaxy' },
    name: 'Zorp',
    emoji: '👽',
    description: 'A friendly alien from the Andromeda galaxy',
    color: '#84CC16',
  },
]
