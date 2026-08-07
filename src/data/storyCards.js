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

export const CARD_KINDS = {
  who: { label: 'who', emoji: '🙂', hint: 'a character' },
  what: { label: 'what', emoji: '🎁', hint: 'a thing' },
  where: { label: 'where', emoji: '🗺️', hint: 'a place' },
  feeling: { label: 'feeling', emoji: '💛', hint: 'how they felt' },
}

export const STORY_CARDS = [
  // who
  { id: 'w-bear', kind: 'who', word: 'the bear', emoji: '🐻' },
  { id: 'w-fox', kind: 'who', word: 'the fox', emoji: '🦊' },
  { id: 'w-robot', kind: 'who', word: 'the robot', emoji: '🤖' },
  { id: 'w-dragon', kind: 'who', word: 'the dragon', emoji: '🐲' },
  { id: 'w-astronaut', kind: 'who', word: 'the astronaut', emoji: '👩‍🚀' },
  { id: 'w-owl', kind: 'who', word: 'the owl', emoji: '🦉' },

  // what
  { id: 't-key', kind: 'what', word: 'a golden key', emoji: '🔑' },
  { id: 't-map', kind: 'what', word: 'an old map', emoji: '🗺️' },
  { id: 't-egg', kind: 'what', word: 'a giant egg', emoji: '🥚' },
  { id: 't-star', kind: 'what', word: 'a fallen star', emoji: '⭐' },
  { id: 't-book', kind: 'what', word: 'a talking book', emoji: '📖' },
  { id: 't-cake', kind: 'what', word: 'an enormous cake', emoji: '🎂' },

  // where
  { id: 'p-forest', kind: 'where', word: 'the deep forest', emoji: '🌲' },
  { id: 'p-moon', kind: 'where', word: 'the moon', emoji: '🌙' },
  { id: 'p-castle', kind: 'where', word: 'an old castle', emoji: '🏰' },
  { id: 'p-sea', kind: 'where', word: 'under the sea', emoji: '🌊' },
  { id: 'p-cave', kind: 'where', word: 'a dark cave', emoji: '🕳️' },
  { id: 'p-garden', kind: 'where', word: 'the garden', emoji: '🌻' },

  // feeling
  { id: 'f-brave', kind: 'feeling', word: 'brave', emoji: '🦁' },
  { id: 'f-curious', kind: 'feeling', word: 'curious', emoji: '🔍' },
  { id: 'f-sleepy', kind: 'feeling', word: 'sleepy', emoji: '😴' },
  { id: 'f-excited', kind: 'feeling', word: 'excited', emoji: '🎉' },
  { id: 'f-worried', kind: 'feeling', word: 'worried', emoji: '😟' },
  { id: 'f-proud', kind: 'feeling', word: 'proud', emoji: '🏅' },
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

export const cardById = (id) => STORY_CARDS.find((c) => c.id === id) ?? null
export const cardsOfKind = (kind) => STORY_CARDS.filter((c) => c.kind === kind)
