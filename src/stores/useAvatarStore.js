import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAvatarStore = create(
  persist(
    (set, get) => ({
      // AI-generated avatar image (base64)
      avatarImage: null,

      // Current feature selections for the AI prompt
      features: {
        skinTone: 'medium',
        hairStyle: 'short',
        hairColor: 'brown',
        clothing: 'blue t-shirt',
        hat: 'none',
        accessory: 'none',
        expression: 'happy smiling',
      },

      // Art style
      artStyle: 'cartoon',

      // Items purchased with coins
      ownedItems: [],

      // Owned art styles (cartoon is free)
      ownedStyles: ['cartoon'],

      // Coin balance
      coins: 0,

      // Generation count today (resets on new day)
      generationsToday: 0,
      generationDate: null,

      // Update a single feature
      setFeature: (key, value) =>
        set((s) => ({
          features: { ...s.features, [key]: value },
        })),

      // Set art style
      setArtStyle: (style) => set({ artStyle: style }),

      // Save generated avatar image
      setAvatarImage: (image) => set({ avatarImage: image }),

      // Track generation count
      incrementGenerations: () => {
        const today = new Date().toDateString()
        const state = get()
        if (state.generationDate !== today) {
          set({ generationsToday: 1, generationDate: today })
        } else {
          set({ generationsToday: state.generationsToday + 1 })
        }
      },

      getGenerationsToday: () => {
        const today = new Date().toDateString()
        const state = get()
        return state.generationDate === today ? state.generationsToday : 0
      },

      // Purchase an art style with coins
      purchaseStyle: (styleId, price) => {
        const state = get()
        if (state.coins < price) return false
        if (state.ownedStyles.includes(styleId)) return false
        set({
          coins: state.coins - price,
          ownedStyles: [...state.ownedStyles, styleId],
        })
        return true
      },

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

      // Add coins
      addCoins: (amount) =>
        set((s) => ({ coins: s.coins + amount })),

      isOwned: (itemId) => get().ownedItems.includes(itemId),
    }),
    { name: 'my-favorite-book-avatar' }
  )
)
