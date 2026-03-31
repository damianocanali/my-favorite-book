// Avatar item catalog — all cosmetic items organized by category.
// Each item has a unique id, visual layers (emoji or SVG path), and unlock method.
// unlock: 'free' | 'coins' | badge ID string

export const AVATAR_BODIES = [
  { id: 'body-1', emoji: '🧒', label: 'Kid', skin: '#FFDBB4', unlock: 'free' },
  { id: 'body-2', emoji: '🧒', label: 'Kid', skin: '#E8B88A', unlock: 'free' },
  { id: 'body-3', emoji: '🧒', label: 'Kid', skin: '#C68642', unlock: 'free' },
  { id: 'body-4', emoji: '🧒', label: 'Kid', skin: '#8D5524', unlock: 'free' },
  { id: 'body-5', emoji: '🧒', label: 'Kid', skin: '#FFDBAC', unlock: 'free' },
  { id: 'body-6', emoji: '🧒', label: 'Kid', skin: '#F1C27D', unlock: 'free' },
]

export const AVATAR_HAIR = [
  { id: 'hair-none', label: 'None', emoji: '', color: null, unlock: 'free' },
  { id: 'hair-short-brown', label: 'Short Brown', emoji: '💇', color: '#5C3317', style: 'short', unlock: 'free' },
  { id: 'hair-short-black', label: 'Short Black', emoji: '💇', color: '#1A1A1A', style: 'short', unlock: 'free' },
  { id: 'hair-long-brown', label: 'Long Brown', emoji: '💇‍♀️', color: '#5C3317', style: 'long', unlock: 'free' },
  { id: 'hair-long-black', label: 'Long Black', emoji: '💇‍♀️', color: '#1A1A1A', style: 'long', unlock: 'free' },
  { id: 'hair-curly-red', label: 'Curly Red', emoji: '🦱', color: '#B7410E', style: 'curly', unlock: 'coins', price: 15 },
  { id: 'hair-short-blond', label: 'Short Blond', emoji: '💇', color: '#F5DEB3', style: 'short', unlock: 'coins', price: 15 },
  { id: 'hair-long-blond', label: 'Long Blond', emoji: '💇‍♀️', color: '#F5DEB3', style: 'long', unlock: 'coins', price: 15 },
  { id: 'hair-curly-brown', label: 'Curly Brown', emoji: '🦱', color: '#5C3317', style: 'curly', unlock: 'coins', price: 15 },
  { id: 'hair-pink', label: 'Pink', emoji: '💇‍♀️', color: '#FF69B4', style: 'long', unlock: 'coins', price: 25 },
  { id: 'hair-blue', label: 'Blue', emoji: '💇', color: '#4FC3F7', style: 'short', unlock: 'coins', price: 25 },
  { id: 'hair-purple', label: 'Purple', emoji: '💇‍♀️', color: '#9C27B0', style: 'long', unlock: 'coins', price: 25 },
]

export const AVATAR_CLOTHING = [
  { id: 'clothes-tshirt-blue', label: 'Blue T-Shirt', emoji: '👕', color: '#4FC3F7', unlock: 'free' },
  { id: 'clothes-tshirt-red', label: 'Red T-Shirt', emoji: '👕', color: '#EF5350', unlock: 'free' },
  { id: 'clothes-tshirt-green', label: 'Green T-Shirt', emoji: '👕', color: '#66BB6A', unlock: 'free' },
  { id: 'clothes-hoodie-purple', label: 'Purple Hoodie', emoji: '🧥', color: '#9C27B0', unlock: 'coins', price: 20 },
  { id: 'clothes-hoodie-black', label: 'Black Hoodie', emoji: '🧥', color: '#333333', unlock: 'coins', price: 20 },
  { id: 'clothes-dress-pink', label: 'Pink Dress', emoji: '👗', color: '#F48FB1', unlock: 'coins', price: 20 },
  { id: 'clothes-dress-yellow', label: 'Yellow Dress', emoji: '👗', color: '#FFD54F', unlock: 'coins', price: 20 },
  { id: 'clothes-suit', label: 'Suit', emoji: '🤵', color: '#37474F', unlock: 'coins', price: 30 },
  { id: 'clothes-overalls', label: 'Overalls', emoji: '🥻', color: '#5C6BC0', unlock: 'coins', price: 25 },
  { id: 'clothes-jersey', label: 'Sports Jersey', emoji: '🎽', color: '#FF7043', unlock: 'coins', price: 25 },
  { id: 'clothes-superhero', label: 'Super Cape', emoji: '🦸', color: '#E53935', unlock: 'first_book', badge: 'first_book' },
  { id: 'clothes-wizard-robe', label: 'Wizard Robe', emoji: '🧙', color: '#5E35B1', unlock: 'five_books', badge: 'five_books' },
]

export const AVATAR_HATS = [
  { id: 'hat-none', label: 'None', emoji: '', unlock: 'free' },
  { id: 'hat-cap-blue', label: 'Blue Cap', emoji: '🧢', color: '#42A5F5', unlock: 'free' },
  { id: 'hat-cap-red', label: 'Red Cap', emoji: '🧢', color: '#EF5350', unlock: 'free' },
  { id: 'hat-beanie', label: 'Beanie', emoji: '🧶', color: '#8D6E63', unlock: 'coins', price: 15 },
  { id: 'hat-cowboy', label: 'Cowboy Hat', emoji: '🤠', color: '#8D6E63', unlock: 'coins', price: 20 },
  { id: 'hat-top', label: 'Top Hat', emoji: '🎩', color: '#212121', unlock: 'coins', price: 25 },
  { id: 'hat-party', label: 'Party Hat', emoji: '🥳', color: '#FF6F00', unlock: 'coins', price: 15 },
  { id: 'hat-bow', label: 'Hair Bow', emoji: '🎀', color: '#E91E63', unlock: 'coins', price: 10 },
  { id: 'hat-headphones', label: 'Headphones', emoji: '🎧', color: '#424242', unlock: 'coins', price: 30 },
  { id: 'hat-flower', label: 'Flower Crown', emoji: '🌸', color: '#F48FB1', unlock: 'coins', price: 20 },
  { id: 'hat-crown', label: 'Crown', emoji: '👑', color: '#FFD600', unlock: 'ten_books', badge: 'ten_books' },
  { id: 'hat-wizard', label: 'Wizard Hat', emoji: '🧙‍♂️', color: '#311B92', unlock: 'used_buddy', badge: 'used_buddy' },
  { id: 'hat-grad', label: 'Graduation Cap', emoji: '🎓', color: '#212121', unlock: 'submitted_class', badge: 'submitted_class' },
]

export const AVATAR_ACCESSORIES = [
  { id: 'acc-none', label: 'None', emoji: '', unlock: 'free' },
  { id: 'acc-glasses', label: 'Glasses', emoji: '👓', color: '#546E7A', unlock: 'free' },
  { id: 'acc-sunglasses', label: 'Sunglasses', emoji: '🕶️', color: '#212121', unlock: 'coins', price: 15 },
  { id: 'acc-necklace', label: 'Necklace', emoji: '📿', color: '#FFD600', unlock: 'coins', price: 20 },
  { id: 'acc-scarf', label: 'Scarf', emoji: '🧣', color: '#E53935', unlock: 'coins', price: 15 },
  { id: 'acc-watch', label: 'Watch', emoji: '⌚', color: '#78909C', unlock: 'coins', price: 20 },
  { id: 'acc-backpack', label: 'Backpack', emoji: '🎒', color: '#FF7043', unlock: 'coins', price: 25 },
  { id: 'acc-wand', label: 'Magic Wand', emoji: '🪄', color: '#9C27B0', unlock: 'coins', price: 30 },
  { id: 'acc-book', label: 'Book', emoji: '📖', color: '#5D4037', unlock: 'coins', price: 10 },
  { id: 'acc-star-glasses', label: 'Star Glasses', emoji: '⭐', color: '#FFD600', unlock: 'three_books', badge: 'three_books' },
  { id: 'acc-trophy', label: 'Trophy', emoji: '🏆', color: '#FFD600', unlock: 'five_books', badge: 'five_books' },
]

export const AVATAR_BACKGROUNDS = [
  { id: 'bg-purple', label: 'Purple', color: '#7C3AED', unlock: 'free' },
  { id: 'bg-blue', label: 'Blue', color: '#2563EB', unlock: 'free' },
  { id: 'bg-green', label: 'Green', color: '#059669', unlock: 'free' },
  { id: 'bg-sunset', label: 'Sunset', color: 'linear-gradient(135deg, #FF6B6B, #FFE66D)', unlock: 'coins', price: 20 },
  { id: 'bg-ocean', label: 'Ocean', color: 'linear-gradient(135deg, #667EEA, #764BA2)', unlock: 'coins', price: 20 },
  { id: 'bg-forest', label: 'Forest', color: 'linear-gradient(135deg, #11998E, #38EF7D)', unlock: 'coins', price: 20 },
  { id: 'bg-fire', label: 'Fire', color: 'linear-gradient(135deg, #F12711, #F5AF19)', unlock: 'coins', price: 25 },
  { id: 'bg-candy', label: 'Candy', color: 'linear-gradient(135deg, #FF9A9E, #FAD0C4)', unlock: 'coins', price: 20 },
  { id: 'bg-galaxy', label: 'Galaxy', color: 'linear-gradient(135deg, #0F0C29, #302B63, #24243E)', unlock: 'first_book', badge: 'first_book' },
  { id: 'bg-rainbow', label: 'Rainbow', color: 'linear-gradient(135deg, #FF0000, #FF7F00, #FFFF00, #00FF00, #0000FF, #8B00FF)', unlock: 'five_pages', badge: 'five_pages' },
]

export const CATEGORIES = [
  { key: 'body', label: 'Body', items: AVATAR_BODIES },
  { key: 'hair', label: 'Hair', items: AVATAR_HAIR },
  { key: 'clothing', label: 'Clothes', items: AVATAR_CLOTHING },
  { key: 'hat', label: 'Hats', items: AVATAR_HATS },
  { key: 'accessory', label: 'Extras', items: AVATAR_ACCESSORIES },
  { key: 'background', label: 'Background', items: AVATAR_BACKGROUNDS },
]

/** Check if an item is unlocked for the user */
export function isItemUnlocked(item, earnedBadges = [], ownedItems = []) {
  if (item.unlock === 'free') return true
  if (item.unlock === 'coins' && ownedItems.includes(item.id)) return true
  // Badge-unlocked items: check if the badge is earned
  if (typeof item.unlock === 'string' && item.unlock !== 'coins') {
    return earnedBadges.includes(item.unlock)
  }
  return false
}
