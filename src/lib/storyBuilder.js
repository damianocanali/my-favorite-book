import { STORY_CARDS, cardById } from '../data/storyCards'

// Pure logic for the drag-and-drop story builder. Separate from the
// component so the slot maths and sentence assembly are testable — the
// UI is drag events, which are painful to test and rarely where the bug
// actually is.

const SLOT_RE = /\{([a-z]+)\}/g

/**
 * Every slot in a frame, addressed `pageIndex:slotIndex`.
 * A kind may repeat within a page ("{who} … {who}") and each occurrence is
 * its own slot, so a child can put a different card in each if they want.
 */
export function slotsForFrame(frame) {
  const slots = []
  ;(frame?.pages ?? []).forEach((page, pageIndex) => {
    let slotIndex = 0
    for (const m of page.matchAll(SLOT_RE)) {
      slots.push({ key: `${pageIndex}:${slotIndex}`, kind: m[1], pageIndex, slotIndex })
      slotIndex += 1
    }
  })
  return slots
}

/** Split one page into literal text and slot descriptors, in order. */
export function segmentsForPage(frame, pageIndex) {
  const page = frame?.pages?.[pageIndex]
  if (typeof page !== 'string') return []
  const out = []
  let last = 0
  let slotIndex = 0
  for (const m of page.matchAll(SLOT_RE)) {
    if (m.index > last) out.push({ type: 'text', value: page.slice(last, m.index) })
    out.push({ type: 'slot', kind: m[1], key: `${pageIndex}:${slotIndex}`, slotIndex })
    slotIndex += 1
    last = m.index + m[0].length
  }
  if (last < page.length) out.push({ type: 'text', value: page.slice(last) })
  return out
}

/** A slot only accepts a card of its own kind. */
export function canDrop(slotKind, cardId) {
  const card = cardById(cardId)
  return !!card && card.kind === slotKind
}

/**
 * Place a card, returning a NEW placement map.
 * A card may be reused across slots — there is no reason a child cannot
 * have the bear appear twice — but a slot holds only one card.
 */
export function place(placements, slotKey, cardId, slotKind) {
  if (!slotKey || !canDrop(slotKind, cardId)) return placements
  return { ...placements, [slotKey]: cardId }
}

export function clearSlot(placements, slotKey) {
  if (!(slotKey in (placements ?? {}))) return placements
  const next = { ...placements }
  delete next[slotKey]
  return next
}

export function missingSlots(frame, placements) {
  return slotsForFrame(frame).filter((s) => !placements?.[s.key])
}

export function isComplete(frame, placements) {
  const all = slotsForFrame(frame)
  return all.length > 0 && missingSlots(frame, placements).length === 0
}

export function progress(frame, placements) {
  const all = slotsForFrame(frame)
  if (all.length === 0) return 0
  return (all.length - missingSlots(frame, placements).length) / all.length
}

/** Renders one page, leaving a readable gap where a slot is still empty. */
export function renderPage(frame, pageIndex, placements) {
  return segmentsForPage(frame, pageIndex)
    .map((seg) => {
      if (seg.type === 'text') return seg.value
      const card = cardById(placements?.[seg.key])
      return card ? card.word : '_____'
    })
    .join('')
}

export function renderStory(frame, placements) {
  return (frame?.pages ?? []).map((_, i) => renderPage(frame, i, placements))
}

/** Cards used on a page, in order — they seed that page's illustration. */
export function cardsOnPage(frame, pageIndex, placements) {
  return segmentsForPage(frame, pageIndex)
    .filter((s) => s.type === 'slot')
    .map((s) => cardById(placements?.[s.key]))
    .filter(Boolean)
}

/** Fills every slot at random. The "shuffle" button. */
export function randomPlacements(frame, pick = (arr) => arr[Math.floor(Math.random() * arr.length)]) {
  const out = {}
  for (const slot of slotsForFrame(frame)) {
    const options = STORY_CARDS.filter((c) => c.kind === slot.kind)
    if (options.length) out[slot.key] = pick(options).id
  }
  return out
}

/**
 * Turns a finished build into the book shape the rest of the app already
 * understands, so this is a real book — editable, illustratable,
 * publishable, printable — not a toy with its own format.
 *
 * Each page keeps an `illustrationHint` built from its cards. The child
 * picked those pictures; the illustration should follow them rather than
 * re-guess from the prose.
 */
export function buildBookFromCards({ frame, placements, authorName, authorAge, makeId }) {
  const now = new Date().toISOString()
  const texts = renderStory(frame, placements)
  return {
    id: makeId(),
    title: frame.title,
    authorName: authorName || 'Me',
    authorAge: authorAge ?? 8,
    colors: { cover: '#8B5CF6', accent: '#06B6D4', text: '#F1F5F9', palette: 'starlight' },
    characters: [],
    setting: null,
    timePeriod: null,
    pages: texts.map((text, i) => {
      const cards = cardsOnPage(frame, i, placements)
      return {
        id: makeId(),
        pageNumber: i + 1,
        text,
        illustrationData: null,
        illustrationRegenCount: 0,
        borderStyle: 'stars',
        illustrationHint: cards.map((c) => c.word).join(', ') || null,
      }
    }),
    coverImage: null,
    createdAt: now,
    updatedAt: now,
  }
}
