// `promptEn` is FROZEN ENGLISH and must never be translated or localised.
// It is concatenated into the FLUX image prompt (src/services/imageGenerator.js),
// and those models are trained overwhelmingly on English captions — an Italian
// prompt term measurably degrades the illustration.
//
// The `name`/`label`/`description` fields below are the English DISPLAY text and
// the fallback for books saved before the split. Translations live in
// src/i18n/locales/<locale>/content.json, keyed by the entry's `id`.
// A story can star up to this many characters (wizard + store enforce it):
// enough for a crew, few enough that every picture can still show them.
export const MAX_CHARACTERS = 4

// Child-typed "create your own" limits (iPad: CharacterStep, same numbers).
export const CUSTOM_NAME_MAX = 24
export const CUSTOM_DESCRIPTION_MAX = 80

export const characters = [
  // People (owner feedback: every story was starring an animal — a
  // president drawn as a fox). Humans first so they are the first choice.
  {
    id: 'girl',
    promptEn: { name: 'Maya the Brave Girl', description: 'A curious young girl who loves big adventures' },
    name: 'Maya the Brave Girl',
    emoji: '👧',
    description: 'A curious girl who loves big adventures',
    color: '#F472B6',
  },
  {
    id: 'boy',
    promptEn: { name: 'Leo the Helpful Boy', description: 'A cheerful young boy who is always ready to help' },
    name: 'Leo the Helpful Boy',
    emoji: '👦',
    description: 'A cheerful boy who is always ready to help',
    color: '#60A5FA',
  },
  {
    id: 'aunt',
    promptEn: { name: 'Aunt Sofia', description: 'A kind grown-up aunt who is great at solving problems' },
    name: 'Aunt Sofia',
    emoji: '👩',
    description: 'A kind aunt who is great at solving problems',
    color: '#A78BFA',
  },
  {
    id: 'uncle',
    promptEn: { name: 'Uncle Marco', description: 'A friendly grown-up uncle who tells the best jokes' },
    name: 'Uncle Marco',
    emoji: '👨',
    description: 'A friendly uncle who tells the best jokes',
    color: '#34D399',
  },
  {
    id: 'grandma',
    promptEn: { name: 'Grandma Greta', description: 'A cheerful grandmother who knows a story for everything' },
    name: 'Grandma Greta',
    emoji: '👵',
    description: 'A cheerful grandma who knows a story for everything',
    color: '#FB923C',
  },
  {
    id: 'grandpa',
    promptEn: { name: 'Grandpa Tom', description: 'A playful grandfather who builds amazing inventions' },
    name: 'Grandpa Tom',
    emoji: '👴',
    description: 'A playful grandpa who builds amazing inventions',
    color: '#FBBF24',
  },
  {
    id: 'teacher',
    promptEn: { name: 'Teacher Sam', description: 'A friendly teacher who makes every lesson an adventure' },
    name: 'Teacher Sam',
    emoji: '🧑‍🏫',
    description: 'A friendly teacher who makes every lesson an adventure',
    color: '#22D3EE',
  },
  {
    id: 'firefighter',
    promptEn: { name: 'Firefighter Alex', description: 'A brave firefighter who helps anyone in trouble' },
    name: 'Firefighter Alex',
    emoji: '🧑‍🚒',
    description: 'A brave firefighter who helps anyone in trouble',
    color: '#EF4444',
  },
  {
    id: 'doctor',
    promptEn: { name: 'Doc Kim', description: 'A caring doctor who helps people and animals feel better' },
    name: 'Doc Kim',
    emoji: '🧑‍⚕️',
    description: 'A caring doctor who helps people and animals feel better',
    color: '#10B981',
  },
  {
    id: 'chef',
    promptEn: { name: 'Chef Nico', description: 'A joyful chef who cooks surprising, delicious food' },
    name: 'Chef Nico',
    emoji: '🧑‍🍳',
    description: 'A joyful chef who cooks surprising, delicious food',
    color: '#F59E0B',
  },
  {
    id: 'king',
    promptEn: { name: 'King Theo', description: 'A kind young king who listens to everyone in his kingdom' },
    name: 'King Theo',
    emoji: '🤴',
    description: 'A kind king who listens to everyone in his kingdom',
    color: '#EAB308',
  },
  {
    id: 'queen',
    promptEn: { name: 'Queen Zara', description: 'A wise queen who is brave, fair and kind' },
    name: 'Queen Zara',
    emoji: '🫅',
    description: 'A wise queen who is brave, fair and kind',
    color: '#C084FC',
  },
  // Heroes and creatures
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
