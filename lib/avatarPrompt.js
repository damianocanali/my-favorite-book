// Pure text-to-image prompt building for avatar generation, shared by
// api/generate-avatar.js (consumer, self-service) and
// api/school/student-avatar.js (teacher, generating on behalf of a student
// in their class). No I/O and no env reads — everything here is a function
// of its arguments, so both callers build the exact same prompt for the
// same inputs, and this file is trivially unit-testable (see
// tests/avatar-prompt.test.js, which pins buildAvatarPrompt's output before
// treating any change here as safe).
//
// `features` values are ENGLISH PROMPT FRAGMENTS spliced straight into the
// FLUX prompt below — ids, not display text. src/pages/AvatarPage.jsx (and
// the shared catalog it now imports) owns the user-facing labels for these
// same ids; never translate or rename an id here without updating both.

export const ART_STYLE_PROMPTS = {
  cartoon: 'cute cartoon style, bold outlines, bright colors, Cartoon Network style',
  pixar: '3D Pixar animation style, soft lighting, expressive features, Disney Pixar render',
  anime: 'anime style, big expressive eyes, colorful, Studio Ghibli inspired',
  watercolor: 'soft watercolor painting style, gentle colors, artistic brushstrokes, storybook illustration',
  pixel: '16-bit pixel art style, retro game character, clean pixel rendering',
  claymation: 'claymation stop-motion style, sculpted plasticine figure, visible fingerprint texture, soft studio lighting',
  comic: 'comic book style, bold black ink outlines, halftone dot shading, bright flat colours, dynamic',
  crayon: "children's crayon drawing style, waxy textured strokes on paper, bright playful colours",
  storybook: 'classic storybook ink illustration, fine pen linework with soft watercolour wash, vintage picture-book',
}

export const ART_STYLE_IDS = Object.keys(ART_STYLE_PROMPTS)

// One entry per feature-builder selector, values matching
// src/pages/AvatarPage.jsx's option ids exactly. api/school/student-avatar.js
// has no free-text moderation pass to fall back on (a teacher's request has
// no prose, only these picks), so this is the only thing standing between a
// direct API call and an arbitrary string landing in the FLUX prompt —
// load-bearing there. generate-avatar.js does NOT validate against this
// (pre-existing, permissive behaviour, preserved by the pin test above); it
// only uses buildAvatarPrompt.
export const ALLOWED_FEATURES = {
  skinTone: ['light', 'fair', 'medium', 'dark', 'peach', 'tan'],
  hairStyle: ['none', 'short', 'long', 'curly', 'braids', 'ponytail', 'mohawk', 'afro'],
  hairColor: ['brown', 'black', 'blonde', 'red', 'pink', 'blue', 'purple'],
  clothing: [
    'blue t-shirt', 'red hoodie', 'green jacket', 'pink dress', 'yellow sweater',
    'purple overalls', 'superhero cape', 'wizard robe', 'sports jersey', 'astronaut suit',
  ],
  hat: [
    'none', 'baseball cap', 'beanie', 'cowboy hat', 'crown', 'wizard hat',
    'party hat', 'flower crown', 'headphones', 'pirate hat',
  ],
  accessory: [
    'none', 'round glasses', 'cool sunglasses', 'star-shaped glasses', 'a red scarf',
    'a magic wand', 'a backpack', 'butterfly wings',
  ],
  expression: [
    'happy smiling', 'excited laughing', 'cool confident', 'silly tongue out',
    'brave determined', 'curious wondering', 'peaceful calm',
  ],
}

/**
 * True when every feature key PRESENT in `features` is one of the allowed
 * ids for that slot. A missing key is fine — buildAvatarPrompt falls back to
 * its own default for it, same as the consumer flow always has — but a
 * present, unrecognized value (free text, prompt-injection attempts, an id
 * from a different catalog) is rejected outright.
 */
export function isValidFeatures(features) {
  if (!features || typeof features !== 'object' || Array.isArray(features)) return false
  return Object.entries(ALLOWED_FEATURES).every(([key, allowed]) => {
    const v = features[key]
    return v === undefined || allowed.includes(v)
  })
}

/** Undefined/null defaults to the cartoon style downstream, same as buildAvatarPrompt. */
export function isValidArtStyle(artStyle) {
  return artStyle == null || ART_STYLE_IDS.includes(artStyle)
}

/**
 * Build the text-to-image FLUX prompt for the feature-builder avatar flow.
 * Pure and deterministic — the same (features, artStyle) always produces the
 * same string, forever (see the pin test).
 */
export function buildAvatarPrompt(features, artStyle) {
  const style = ART_STYLE_PROMPTS[artStyle] || ART_STYLE_PROMPTS.cartoon

  const parts = [
    'Portrait of a friendly child character',
    `${features.skinTone || 'medium'} skin tone`,
    features.hairStyle && features.hairStyle !== 'none' ? `${features.hairColor || ''} ${features.hairStyle} hair` : 'no hair',
    features.clothing ? `wearing a ${features.clothing}` : '',
    features.hat && features.hat !== 'none' ? `wearing a ${features.hat}` : '',
    features.accessory && features.accessory !== 'none' ? `with ${features.accessory}` : '',
    features.expression || 'happy smiling expression',
  ].filter(Boolean).join(', ')

  return `${parts}. ${style}. Centered circular avatar portrait, simple clean background, child-friendly, no text, no watermark, safe for kids.`
}
