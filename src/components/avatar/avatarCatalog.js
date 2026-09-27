// The avatar feature-builder catalog: skin tone, hair, clothing, hat,
// accessory, expression, and art style options. Shared by
// src/pages/AvatarPage.jsx (a consumer building their own avatar) and
// src/components/school/StudentAvatarEditor.jsx (a teacher building one for
// a student in their class) — extracted from AvatarPage.jsx so the two
// pickers can never drift on what a given feature id actually looks/reads
// like.
//
// `id` is an ENGLISH PROMPT FRAGMENT. lib/avatarPrompt.js splices it straight
// into the FLUX prompt ("wearing a blue t-shirt", "with star-shaped
// glasses"), and the avatar store / user_inventory persist it, so an id must
// NEVER be translated or renamed — keep lib/avatarPrompt.js's
// ALLOWED_FEATURES / ART_STYLE_PROMPTS in sync with any change here.
// `labelKey` is the display-only text, keyed by a stable slug of the id.
export const SKIN_TONES = [
  { id: 'light', labelKey: 'content:avatar.skin_tone.light.label', color: '#FFDBB4' },
  { id: 'fair', labelKey: 'content:avatar.skin_tone.fair.label', color: '#E8B88A' },
  { id: 'medium', labelKey: 'content:avatar.skin_tone.medium.label', color: '#C68642' },
  { id: 'dark', labelKey: 'content:avatar.skin_tone.dark.label', color: '#8D5524' },
  { id: 'peach', labelKey: 'content:avatar.skin_tone.peach.label', color: '#FFDBAC' },
  { id: 'tan', labelKey: 'content:avatar.skin_tone.tan.label', color: '#F1C27D' },
]

export const HAIR_STYLES = [
  { id: 'none', labelKey: 'content:avatar.hair_style.none.label' },
  { id: 'short', labelKey: 'content:avatar.hair_style.short.label' },
  { id: 'long', labelKey: 'content:avatar.hair_style.long.label' },
  { id: 'curly', labelKey: 'content:avatar.hair_style.curly.label' },
  { id: 'braids', labelKey: 'content:avatar.hair_style.braids.label' },
  { id: 'ponytail', labelKey: 'content:avatar.hair_style.ponytail.label' },
  { id: 'mohawk', labelKey: 'content:avatar.hair_style.mohawk.label' },
  { id: 'afro', labelKey: 'content:avatar.hair_style.afro.label' },
]

export const HAIR_COLORS = [
  { id: 'brown', labelKey: 'content:avatar.hair_color.brown.label', color: '#5C3317' },
  { id: 'black', labelKey: 'content:avatar.hair_color.black.label', color: '#1A1A1A' },
  { id: 'blonde', labelKey: 'content:avatar.hair_color.blonde.label', color: '#F5DEB3' },
  { id: 'red', labelKey: 'content:avatar.hair_color.red.label', color: '#B7410E' },
  { id: 'pink', labelKey: 'content:avatar.hair_color.pink.label', color: '#FF69B4' },
  { id: 'blue', labelKey: 'content:avatar.hair_color.blue.label', color: '#4FC3F7' },
  { id: 'purple', labelKey: 'content:avatar.hair_color.purple.label', color: '#9C27B0' },
]

export const CLOTHING_OPTIONS = [
  { id: 'blue t-shirt', labelKey: 'content:avatar.clothing.blue_t_shirt.label' },
  { id: 'red hoodie', labelKey: 'content:avatar.clothing.red_hoodie.label' },
  { id: 'green jacket', labelKey: 'content:avatar.clothing.green_jacket.label' },
  { id: 'pink dress', labelKey: 'content:avatar.clothing.pink_dress.label' },
  { id: 'yellow sweater', labelKey: 'content:avatar.clothing.yellow_sweater.label' },
  { id: 'purple overalls', labelKey: 'content:avatar.clothing.purple_overalls.label' },
  { id: 'superhero cape', labelKey: 'content:avatar.clothing.superhero_cape.label' },
  { id: 'wizard robe', labelKey: 'content:avatar.clothing.wizard_robe.label' },
  { id: 'sports jersey', labelKey: 'content:avatar.clothing.sports_jersey.label' },
  { id: 'astronaut suit', labelKey: 'content:avatar.clothing.astronaut_suit.label' },
]

export const HAT_OPTIONS = [
  { id: 'none', labelKey: 'content:avatar.hat.none.label' },
  { id: 'baseball cap', labelKey: 'content:avatar.hat.baseball_cap.label' },
  { id: 'beanie', labelKey: 'content:avatar.hat.beanie.label' },
  { id: 'cowboy hat', labelKey: 'content:avatar.hat.cowboy_hat.label' },
  { id: 'crown', labelKey: 'content:avatar.hat.crown.label' },
  { id: 'wizard hat', labelKey: 'content:avatar.hat.wizard_hat.label' },
  { id: 'party hat', labelKey: 'content:avatar.hat.party_hat.label' },
  { id: 'flower crown', labelKey: 'content:avatar.hat.flower_crown.label' },
  { id: 'headphones', labelKey: 'content:avatar.hat.headphones.label' },
  { id: 'pirate hat', labelKey: 'content:avatar.hat.pirate_hat.label' },
]

export const ACCESSORY_OPTIONS = [
  { id: 'none', labelKey: 'content:avatar.accessory.none.label' },
  { id: 'round glasses', labelKey: 'content:avatar.accessory.round_glasses.label' },
  { id: 'cool sunglasses', labelKey: 'content:avatar.accessory.cool_sunglasses.label' },
  { id: 'star-shaped glasses', labelKey: 'content:avatar.accessory.star_shaped_glasses.label' },
  { id: 'a red scarf', labelKey: 'content:avatar.accessory.a_red_scarf.label' },
  { id: 'a magic wand', labelKey: 'content:avatar.accessory.a_magic_wand.label' },
  { id: 'a backpack', labelKey: 'content:avatar.accessory.a_backpack.label' },
  { id: 'butterfly wings', labelKey: 'content:avatar.accessory.butterfly_wings.label' },
]

export const EXPRESSION_OPTIONS = [
  { id: 'happy smiling', labelKey: 'content:avatar.expression.happy_smiling.label' },
  { id: 'excited laughing', labelKey: 'content:avatar.expression.excited_laughing.label' },
  { id: 'cool confident', labelKey: 'content:avatar.expression.cool_confident.label' },
  { id: 'silly tongue out', labelKey: 'content:avatar.expression.silly_tongue_out.label' },
  { id: 'brave determined', labelKey: 'content:avatar.expression.brave_determined.label' },
  { id: 'curious wondering', labelKey: 'content:avatar.expression.curious_wondering.label' },
  { id: 'peaceful calm', labelKey: 'content:avatar.expression.peaceful_calm.label' },
]

// Art-style ids key lib/avatarPrompt.js's ART_STYLE_PROMPTS table and the
// `ownedStyles` rows in user_inventory — wire values, never translated.
// `price` is display-only: a class account is never charged (the school's
// license already covers every style — see StudentAvatarEditor.jsx), only
// a consumer on AvatarPage spends coins for a non-free one.
export const ART_STYLES = [
  { id: 'cartoon', labelKey: 'content:avatar.art_style.cartoon.label', emoji: '🎨', price: 0 },
  { id: 'pixar', labelKey: 'content:avatar.art_style.pixar.label', emoji: '✨', price: 15 },
  { id: 'anime', labelKey: 'content:avatar.art_style.anime.label', emoji: '🌸', price: 15 },
  { id: 'watercolor', labelKey: 'content:avatar.art_style.watercolor.label', emoji: '🖌️', price: 15 },
  { id: 'pixel', labelKey: 'content:avatar.art_style.pixel.label', emoji: '👾', price: 15 },
  { id: 'claymation', labelKey: 'content:avatar.art_style.claymation.label', emoji: '🧸', price: 15 },
  { id: 'comic', labelKey: 'content:avatar.art_style.comic.label', emoji: '💥', price: 15 },
  { id: 'crayon', labelKey: 'content:avatar.art_style.crayon.label', emoji: '🖍️', price: 15 },
  { id: 'storybook', labelKey: 'content:avatar.art_style.storybook.label', emoji: '📜', price: 15 },
]
