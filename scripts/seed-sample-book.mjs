// scripts/seed-sample-book.mjs
//
// One-time seed: inserts "Theo and the Star Bear" (the /example sample
// book) into user_books, owned by your account, so you can place a real
// print order against it as a production smoke test.
//
// Why this script exists:
//   The normal /api/sync-books path strips illustration data to a
//   '[saved-locally]' placeholder (real base64 lives in localStorage),
//   so a synced book has no images server-side. The print pipeline needs
//   real, server-fetchable image URLs to render the PDF. This script
//   writes a user_books row with ABSOLUTE URLs pointing to the static
//   /sample-book/*.png assets, so Puppeteer can fetch them at render time.
//
// Run with:
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   OWNER_USER_ID=f6fde021-be6b-4cc9-ab1e-4851ee7d0117 \
//   SITE_URL=https://mybooklab.app \
//   node scripts/seed-sample-book.mjs
//
// Idempotent: re-running upserts the same row (on_conflict user_id+book_id).
// After seeding, open /bookshelf, pick "Theo and the Star Bear", and run the
// normal print order flow.

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OWNER_USER_ID = process.env.OWNER_USER_ID
const SITE_URL = (process.env.SITE_URL ?? 'https://mybooklab.app').replace(/\/$/, '')

for (const [k, v] of Object.entries({ SUPABASE_URL, SERVICE_KEY, OWNER_USER_ID })) {
  if (!v) {
    console.error(`Missing required env: ${k}`)
    process.exit(1)
  }
}

const BOOK_ID = 'sample-theo-and-the-star-bear'

const SAMPLE_BOOK = {
  id: BOOK_ID,
  title: 'Theo and the Star Bear',
  authorName: 'Theo',
  authorAge: 7,
  authorAvatar: `${SITE_URL}/sample-book/author.png`,
  createdAt: '2026-05-07T00:00:00Z',
  updatedAt: new Date().toISOString(),
  colors: {
    cover: '#5B3FA8',
    accent: '#F4B860',
    text: '#FFF8E7',
  },
  coverImage: `${SITE_URL}/sample-book/cover.png`,
  characters: [
    { id: 'c1', name: 'Theo', emoji: '👦🏼', description: 'A curious 7-year-old who loves stargazing.' },
    { id: 'c2', name: 'Twinkle', emoji: '🌟', description: 'A fluffy bear made entirely of starlight.' },
  ],
  setting: {
    id: 's1',
    name: 'The Glowing Forest',
    label: 'The Glowing Forest',
    emoji: '🌲',
    description: 'A magical forest where stars come down at night and mushrooms shine like lamps.',
  },
  pages: [
    { id: 1, pageNumber: 1, illustrationData: `${SITE_URL}/sample-book/page-01.png`,
      text: 'Theo loved to look at the stars before bed. Every night, they sparkled like diamonds in the sky.' },
    { id: 2, pageNumber: 2, illustrationData: `${SITE_URL}/sample-book/page-02.png`,
      text: 'But one night, something different happened. A tiny star floated down through his window!' },
    { id: 3, pageNumber: 3, illustrationData: `${SITE_URL}/sample-book/page-03.png`,
      text: 'The star wiggled and grew, until it became a fluffy bear made of starlight. "Hello, Theo!" it said. "I\'m Twinkle."' },
    { id: 4, pageNumber: 4, illustrationData: `${SITE_URL}/sample-book/page-04.png`,
      text: '"Come with me," Twinkle whispered. "The Glowing Forest needs your help."' },
    { id: 5, pageNumber: 5, illustrationData: `${SITE_URL}/sample-book/page-05.png`,
      text: 'They flew on a moonbeam to a place Theo had never seen. The trees were silver, and the mushrooms shone like lamps.' },
    { id: 6, pageNumber: 6, illustrationData: `${SITE_URL}/sample-book/page-06.png`,
      text: '"A storm cloud put out our stars," said Twinkle. "We need to wake them up again."' },
    { id: 7, pageNumber: 7, illustrationData: `${SITE_URL}/sample-book/page-07.png`,
      text: 'Theo cupped his hands and gathered some shimmer-dust from the path. "Maybe this will help!"' },
    { id: 8, pageNumber: 8, illustrationData: `${SITE_URL}/sample-book/page-08.png`,
      text: 'He blew the shimmer-dust toward the dim stars. They began to glow brighter and brighter.' },
    { id: 9, pageNumber: 9, illustrationData: `${SITE_URL}/sample-book/page-09.png`,
      text: 'Soon the forest twinkled like never before. The fireflies danced and the leaves sang.' },
    { id: 10, pageNumber: 10, illustrationData: `${SITE_URL}/sample-book/page-10.png`,
      text: '"You did it!" cheered Twinkle. "You saved the Glowing Forest!"' },
    { id: 11, pageNumber: 11, illustrationData: `${SITE_URL}/sample-book/page-11.png`,
      text: 'Twinkle gave Theo a tiny star to keep. "Whenever you look at it, you\'ll remember our adventure."' },
    { id: 12, pageNumber: 12, illustrationData: `${SITE_URL}/sample-book/page-12.png`,
      text: 'Theo woke up in his bed. The little star sat glowing on his pillow. He smiled, knowing the magic was real.' },
  ],
}

const record = {
  user_id: OWNER_USER_ID,
  book_id: BOOK_ID,
  book_data: SAMPLE_BOOK,
  title: SAMPLE_BOOK.title,
  updated_at: SAMPLE_BOOK.updatedAt,
}

console.log(`Seeding "${SAMPLE_BOOK.title}" for user ${OWNER_USER_ID}…`)
console.log(`Using image base: ${SITE_URL}/sample-book/`)

const res = await fetch(
  `${SUPABASE_URL}/rest/v1/user_books?on_conflict=user_id,book_id`,
  {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(record),
  }
)

if (!res.ok) {
  console.error(`Upsert failed (${res.status}): ${await res.text()}`)
  process.exit(1)
}

const rows = await res.json()
console.log('\nSeeded successfully.')
console.log('  book_id:', rows?.[0]?.book_id ?? BOOK_ID)
console.log('  title:  ', rows?.[0]?.title ?? SAMPLE_BOOK.title)
console.log('\nNext step:')
console.log(`  1. Open ${SITE_URL}/bookshelf in the browser`)
console.log('  2. Tap "Theo and the Star Bear"')
console.log('  3. Hit "Print this book" and place the real order')
console.log(`  Or jump straight to: ${SITE_URL}/print/${BOOK_ID}`)
