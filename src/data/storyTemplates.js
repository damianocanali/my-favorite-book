// Fill-in-the-blanks story templates.
//
// Every blank is a *tap* choice backed by a word bank, with typing as an
// option rather than the requirement. That is the whole reason this
// mechanic was chosen over drag-and-drop for ages 4-8: a four-year-old
// who cannot yet spell "dinosaur" can still author a story, and a bank of
// buttons is keyboard- and VoiceOver-navigable for free, which a drag
// surface is not.
//
// Word banks are deliberately concrete and picturable — they become
// illustration prompts later, and "shimmering" makes a worse picture than
// "purple". Nothing in a bank can combine into something unkind.

export const WORD_BANKS = {
  name: {
    label: 'a name',
    emoji: '🙂',
    // Seeded from the child's own name at runtime; these are the fallback.
    words: ['Theo', 'Mia', 'Ada', 'Sam', 'Nia', 'Leo', 'Iris', 'Kai'],
    allowCustom: true,
  },
  animal: {
    label: 'an animal',
    emoji: '🐾',
    words: ['bear', 'fox', 'penguin', 'dragon', 'turtle', 'owl', 'whale', 'rabbit', 'tiger', 'dinosaur'],
  },
  colour: {
    label: 'a colour',
    emoji: '🎨',
    words: ['red', 'blue', 'golden', 'purple', 'green', 'silver', 'orange', 'pink'],
  },
  place: {
    label: 'a place',
    emoji: '🗺️',
    words: ['forest', 'moon', 'castle', 'beach', 'cave', 'garden', 'mountain', 'island'],
  },
  silly: {
    label: 'a silly word',
    emoji: '🤪',
    words: ['wobbly', 'sparkly', 'enormous', 'tiny', 'bouncy', 'fuzzy', 'upside-down', 'giggly'],
  },
  food: {
    label: 'something tasty',
    emoji: '🍎',
    words: ['pancakes', 'apples', 'soup', 'honey', 'berries', 'cake', 'noodles', 'ice cream'],
  },
  sound: {
    label: 'a sound',
    emoji: '🔊',
    words: ['WHOOSH', 'ping', 'rumble', 'squeak', 'ta-da', 'boing', 'shhh', 'kaboom'],
  },
}

// {slotKey} markers are replaced by the child's picks. A slot may repeat
// across pages — "Theo" should stay Theo — so the same key always resolves
// to the same word.
export const STORY_TEMPLATES = [
  {
    id: 'space-friend',
    title: 'My Space Friend',
    emoji: '🚀',
    blurb: 'Someone lands in your garden.',
    pages: [
      'One quiet morning, {name} heard a loud {sound} outside the window.',
      'In the garden sat a {colour} {animal} from the {place}, looking very lost.',
      'It was hungry, so {name} shared some {food} until it stopped shaking.',
      'They played all afternoon, and the {silly} {animal} promised to come back.',
    ],
  },
  {
    id: 'lost-thing',
    title: 'The Lost Thing',
    emoji: '🔦',
    blurb: 'Something goes missing. You find it.',
    pages: [
      '{name} looked everywhere, but the {colour} key was gone.',
      'A {silly} {animal} said it had seen something shiny down by the {place}.',
      'They searched together until they heard a small {sound} under a rock.',
      'There it was. {name} said thank you and shared the last of the {food}.',
    ],
  },
  {
    id: 'brave-night',
    title: 'The Bravest Night',
    emoji: '🌙',
    blurb: 'It is dark. You are braver than you think.',
    pages: [
      'The lights went out, and {name} did not feel brave at all.',
      'Then a {colour} {animal} appeared and whispered, "Follow me to the {place}."',
      'Every time {name} felt scared, they said the magic word: {sound}!',
      'By morning {name} knew something new: being {silly} and scared can happen at once.',
    ],
  },
]

/** Slot keys used by a template, in first-appearance order. */
export function slotsForTemplate(template) {
  if (!template?.pages) return []
  const seen = []
  for (const page of template.pages) {
    for (const m of page.matchAll(/\{([a-z]+)\}/g)) {
      if (WORD_BANKS[m[1]] && !seen.includes(m[1])) seen.push(m[1])
    }
  }
  return seen
}
