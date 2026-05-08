// scripts/generate-sample-illustrations.mjs
//
// One-time script that generates the illustrations for the in-app
// sample book ("Theo and the Star Bear") via Together AI's FLUX schnell
// and saves them to public/sample-book/. The PNGs are committed to the
// repo so the sample book ships in the bundle without external storage.
//
// Run with: TOGETHER_API_KEY=... node scripts/generate-sample-illustrations.mjs
//
// Re-running overwrites existing files. Each image is ~80–150KB; total
// ~1.5–2 MB committed once.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'sample-book')

const TOGETHER_URL = 'https://api.together.xyz/v1/images/generations'
const STYLE_SUFFIX = ' Children\'s storybook illustration, colorful, friendly, whimsical, cute cartoon style, soft colors, safe for kids, no text, no words, no letters.'

// Mirror of SAMPLE_ILLUSTRATION_PROMPTS in src/data/sampleBook.js.
// Kept duplicated to keep this script standalone and runnable without
// depending on Vite's import.meta resolution. If you change one, change
// the other.
const PROMPTS = {
  'cover.png':
    'A whimsical children\'s book cover: a young boy with curly brown hair in pajamas and a small fluffy bear made of glittering starlight, flying together on a glowing moonbeam over a magical forest at night. Silver trees, glowing mushrooms, swirling stars, soft purple and gold palette. Storybook illustration style, vibrant, dreamy.',
  'author.png':
    'A friendly cartoon portrait of a smiling 7-year-old boy with curly brown hair and a red jacket, against a soft cream background. Simple and warm.',
  'page-01.png':
    'A young boy with curly brown hair in striped pajamas at a bedroom window at night, gazing up at a sky full of sparkling stars. Cozy bedroom, soft purples.',
  'page-02.png':
    'A small glowing star drifting in through an open bedroom window, leaving a trail of sparkles, toward a wide-eyed boy in pajamas. Magical and warm.',
  'page-03.png':
    'A small fluffy bear made entirely of glittering starlight standing in a child\'s bedroom, with a crescent-moon mark on its forehead, smiling kindly. The boy looks delighted.',
  'page-04.png':
    'A glittering star bear pointing out a bedroom window with one paw, sparkles trailing behind. The boy listens, eyes wide. Dreamy.',
  'page-05.png':
    'A young boy and a fluffy starlight bear riding a glowing moonbeam over a magical forest at night, with silver-leafed trees and mushrooms shining like lanterns. Wide scene, vibrant, dreamy.',
  'page-06.png':
    'A grey storm cloud hanging low over a magical forest at night, with dim stars hanging from the cloud, the forest below in darker tones.',
  'page-07.png':
    'A young boy kneeling on a glowing forest path, cupping his hands to gather sparkling shimmer-dust. The starlight bear watches beside him.',
  'page-08.png':
    'A boy blowing sparkly shimmer-dust upward toward a sky of stars that are beginning to brighten and shine. Ascending sparkles.',
  'page-09.png':
    'A vibrant magical forest at night with brilliantly glowing stars, dancing fireflies, leaves that seem to sing, silver trees and luminous mushrooms. Joyful.',
  'page-10.png':
    'A young boy hugging a fluffy starlight bear in a clearing of a glowing forest, both smiling, surrounded by bright stars and glowing mushrooms.',
  'page-11.png':
    'A glittering starlight bear gently placing a tiny shimmering star into a young boy\'s cupped hands, in a magical forest clearing. Tender moment.',
  'page-12.png':
    'A young boy waking up in a cozy bed in the morning light, smiling, with a small glowing star sitting on his pillow beside him. Warm yellow morning light.',
}

async function generateOne(filename, prompt) {
  const apiKey = process.env.TOGETHER_API_KEY
  if (!apiKey) throw new Error('TOGETHER_API_KEY not set')

  const isCover = filename === 'cover.png'
  const isAuthor = filename === 'author.png'
  const fullPrompt = `${prompt}${STYLE_SUFFIX}`

  const body = {
    model: 'black-forest-labs/FLUX.1-schnell',
    prompt: fullPrompt,
    width: isAuthor ? 512 : 768,
    height: isAuthor ? 512 : 512,
    steps: 4,
    n: 1,
    response_format: 'b64_json',
  }

  const res = await fetch(TOGETHER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`${filename}: ${res.status} ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error(`${filename}: response missing b64_json`)
  return Buffer.from(b64, 'base64')
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  const entries = Object.entries(PROMPTS)
  console.log(`Generating ${entries.length} illustrations into ${OUT_DIR}\n`)

  for (const [filename, prompt] of entries) {
    process.stdout.write(`  ${filename}…`)
    try {
      const buf = await generateOne(filename, prompt)
      await fs.writeFile(path.join(OUT_DIR, filename), buf)
      process.stdout.write(` ✓ ${(buf.length / 1024).toFixed(0)} KB\n`)
    } catch (err) {
      process.stdout.write(` ✗ ${err.message}\n`)
      // Continue with the rest — partial success is fine; you can re-run.
    }
    // Tiny delay so we don't hammer the rate limit.
    await new Promise((r) => setTimeout(r, 250))
  }

  console.log('\nDone. Commit public/sample-book/*.png to bundle the sample book with the app.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
