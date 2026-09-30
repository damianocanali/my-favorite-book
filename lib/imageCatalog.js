// Catalogue content the SERVER trusts for the offline picture fallback.
//
// When the scene writer is unavailable, lib/imageScene.js builds a prompt
// locally, and that prompt must never contain child-typed text. The only
// words it may use are the ones below: our own frozen-English catalogue
// entries, looked up by value on the server, so a client can't smuggle text
// in by claiming something is "catalogue".
//
// Web catalogue entries are imported from src/data (pure data modules).
// Story cards and the iOS lists live in files that can't be imported into
// an edge function (i18next / Swift), so they are copied here and
// tests/image-catalog.test.js fails if they drift.
import { characters } from '../src/data/characters.js'
import { scenes } from '../src/data/scenes.js'
import { timePeriods } from '../src/data/timePeriods.js'

const lower = (s) => String(s ?? '').trim().toLowerCase()

/** Web catalogue characters by lower-cased English name → { name, description }. */
export const CATALOG_CHARACTERS = new Map(
  characters.map((c) => [lower(c.promptEn.name), { name: c.promptEn.name, description: c.promptEn.description }])
)

/** iOS BookCharacter.emojiSpecies values (ios-native/MyBookLab/Models/Book.swift). */
export const KNOWN_SPECIES = new Set([
  'a fox', 'a bear', 'a rabbit', 'a unicorn', 'a dragon', 'a lion', 'a cat', 'a puppy',
  'a turtle', 'an owl', 'a frog', 'a panda', 'a koala', 'a tiger', 'a giraffe', 'an elephant',
  'a zebra', 'a raccoon', 'a wolf', 'a hedgehog', 'a bee', 'a butterfly', 'an octopus', 'a dinosaur',
  'a penguin', 'a parrot', 'a swan', 'a flamingo', 'a dolphin', 'a whale', 'a shark', 'a fish',
  'a young boy', 'a young girl', 'a child', 'a baby', 'an astronaut', 'a superhero', 'a fairy',
  'a mermaid', 'a genie', 'a wizard', 'a witch', 'a princess', 'a prince', 'a ninja', 'a robot',
  'an alien', 'Santa Claus', 'an elf', 'a friendly star', 'a rainbow', 'a magic crystal ball',
  'a balloon', 'a rocket', 'a castle', 'a crown', 'a cookie', 'a tooth', 'a snowflake', 'a flame',
].map(lower))

/** Setting names: web scenes + iOS setting presets (CreateBookView.swift). */
export const CATALOG_SETTINGS = new Map([
  ...scenes.map((s) => [lower(s.promptEn.name), s.promptEn.name]),
  ...['The Glowing Forest', 'The Cloud Kingdom', 'The Coral City', 'The Cookie Planet',
    'The Snow Castle', 'The Dinosaur Valley'].map((n) => [lower(n), n]),
])

export const CATALOG_TIME_PERIODS = new Map(timePeriods.map((t) => [lower(t.promptEn.label), t.promptEn.label]))

/** Story card promptEn words (src/data/storyCards.js). */
export const CATALOG_CARDS = new Set([
  'the bear', 'the fox', 'the robot', 'the dragon', 'the astronaut', 'the owl',
  'a golden key', 'an old map', 'a giant egg', 'a fallen star', 'a talking book', 'an enormous cake',
  'the deep forest', 'the moon', 'an old castle', 'under the sea', 'a dark cave', 'the garden',
  'brave', 'curious', 'sleepy', 'excited', 'worried', 'proud',
])

export { lower }
