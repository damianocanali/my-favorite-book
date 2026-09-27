// What can be bought with coins, and what it costs — the server's copy, and
// the one that counts.
//
// The web and iOS stores show prices too, but those are only for display.
// Before this file existed, /api/spend-coins took the amount from the client
// and only checked the balance covered it, so anyone calling the API directly
// could buy a 15-coin style for 1 coin. A purchase is now charged exactly the
// price listed here, or refused.
//
// Adding something to the store means adding it here, in the same change.

export const CATALOG = {
  // Avatar art styles. `cartoon` is free and owned by default, so not listed.
  style: {
    pixar: 15,
    anime: 15,
    watercolor: 15,
    pixel: 15,
    claymation: 15,
    comic: 15,
    crayon: 15,
    storybook: 15,
  },
  // Other one-off items. App icons are iOS-only.
  item: {
    icon_rocket: 100,
    icon_rainbow: 100,
    icon_dino: 100,
    icon_ocean: 100,
    icon_dragon: 100,
  },
}

/// The price of a purchasable, or null if it isn't for sale.
export function priceOf(kind, id) {
  const table = CATALOG[kind]
  if (!table || !Object.prototype.hasOwnProperty.call(table, id)) return null
  return table[id]
}
