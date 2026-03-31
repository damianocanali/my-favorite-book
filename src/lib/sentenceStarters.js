// Sentence starters organized by story position and theme.
// Designed to reduce "blank page anxiety" for ADHD learners by
// providing tap-to-insert scaffolds.

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
  const pool = [...STARTERS_BY_POSITION[position]]
  const starters = []
  for (let i = 0; i < Math.min(4, pool.length); i++) {
    const idx = Math.floor(Math.random() * pool.length)
    starters.push(pool.splice(idx, 1)[0])
  }

  return { starters, feelings: FEELING_WORDS, actions: ACTION_WORDS }
}

/**
 * Returns a random idle nudge message.
 */
export function getIdleNudge(characterName) {
  const nudges = [
    'Need an idea? Try one of the sentence starters above!',
    `What happens next to ${characterName || 'your character'}?`,
    'How is your character feeling right now?',
    'Try describing what your character can see around them.',
    'What sound does your character hear?',
    `What does ${characterName || 'your character'} decide to do?`,
    'Close your eyes and imagine the scene — then describe it!',
    'What would YOU do if you were in this story?',
  ]
  return nudges[Math.floor(Math.random() * nudges.length)]
}
