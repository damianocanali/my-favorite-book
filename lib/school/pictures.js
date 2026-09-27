// The picture alphabet for student sign-in. Language-free on purpose: the
// children are 6–12, many pre-literate or dyslexic, and the class may be
// English or Italian. Ids are internal and never shown; only the emoji is.
// Order is part of nothing — secrets store ids, not positions.
export const PICTURES = [
  { id: 'cat', emoji: '🐱' }, { id: 'dog', emoji: '🐶' }, { id: 'fish', emoji: '🐟' }, { id: 'frog', emoji: '🐸' },
  { id: 'lion', emoji: '🦁' }, { id: 'owl', emoji: '🦉' }, { id: 'turtle', emoji: '🐢' }, { id: 'bee', emoji: '🐝' },
  { id: 'sun', emoji: '☀️' }, { id: 'moon', emoji: '🌙' }, { id: 'star', emoji: '⭐' }, { id: 'tree', emoji: '🌳' },
  { id: 'apple', emoji: '🍎' }, { id: 'boat', emoji: '⛵' }, { id: 'rocket', emoji: '🚀' }, { id: 'ball', emoji: '⚽' },
]
export const PICTURE_IDS = PICTURES.map((p) => p.id)

// Name-tile avatars, so a child who cannot read yet can still find themself.
// Deliberately disjoint from PICTURES so a tile never hints at a password.
export const AVATAR_EMOJI = [
  '🦊', '🐼', '🐨', '🐯', '🐮', '🐷', '🐵', '🐧', '🐤', '🦄',
  '🐙', '🦋', '🐞', '🦕', '🦖', '🐳', '🐬', '🦓', '🦒', '🐘',
  '🦔', '🦦', '🦥', '🐿️', '🦩', '🦜', '🐊', '🐇', '🦘', '🦡',
  '🌵', '🌻', '🍄', '🌈', '🍉', '🍩', '🧁', '🎈', '🎸', '🪁',
]
