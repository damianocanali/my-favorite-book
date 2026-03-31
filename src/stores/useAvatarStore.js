import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAvatarStore = create(
  persist(
    (set, get) => ({
      // Currently equipped items (one per category)
      equipped: {
        body: 'body-1',
        hair: 'hair-short-brown',
        clothing: 'clothes-tshirt-blue',
        hat: 'hat-none',
        accessory: 'acc-none',
        background: 'bg-purple',
      },

      // Items purchased with coins
      ownedItems: [],

      // Coin balance
      coins: 0,

      // Equip an item to a category slot
      equip: (category, itemId) =>
        set((s) => ({
          equipped: { ...s.equipped, [category]: itemId },
        })),

      // Purchase an item with coins
      purchaseItem: (itemId, price) => {
        const state = get()
        if (state.coins < price) return false
        if (state.ownedItems.includes(itemId)) return false
        set({
          coins: state.coins - price,
          ownedItems: [...state.ownedItems, itemId],
        })
        return true
      },

      // Add coins (from subscription bonus or coin pack purchase)
      addCoins: (amount) =>
        set((s) => ({ coins: s.coins + amount })),

      // Check if an item is owned (purchased or free)
      isOwned: (itemId) => get().ownedItems.includes(itemId),
    }),
    { name: 'my-favorite-book-avatar' }
  )
)
