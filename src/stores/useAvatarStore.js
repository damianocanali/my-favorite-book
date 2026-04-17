import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFetchAuthed } from '../lib/api'

// The coin balance is authoritative on the server. We mirror it in the store
// so the UI can read it synchronously, but every mutation goes through the
// server — refreshCoins to pull, spendCoins to atomically debit. The
// persisted value is only a warm-start hint; fetchCoins reconciles it on
// load.

async function serverSpend(amount) {
  const res = await apiFetchAuthed('/api/spend-coins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  })
  if (res.status === 402) return { ok: false, insufficient: true }
  if (!res.ok) return { ok: false, error: true }
  const data = await res.json().catch(() => null)
  if (data?.balance === undefined) return { ok: false, error: true }
  return { ok: true, balance: data.balance }
}

export const useAvatarStore = create(
  persist(
    (set, get) => ({
      avatarImage: null,

      features: {
        skinTone: 'medium',
        hairStyle: 'short',
        hairColor: 'brown',
        clothing: 'blue t-shirt',
        hat: 'none',
        accessory: 'none',
        expression: 'happy smiling',
      },

      artStyle: 'cartoon',
      ownedItems: [],
      ownedStyles: ['cartoon'],
      coins: 0,

      generationsToday: 0,
      generationDate: null,

      setFeature: (key, value) =>
        set((s) => ({ features: { ...s.features, [key]: value } })),

      setArtStyle: (style) => set({ artStyle: style }),
      setAvatarImage: (image) => set({ avatarImage: image }),

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

      // Fetch the server-side balance. Safe to call whenever we land on a
      // coin-aware screen or after a purchase redirect.
      refreshCoins: async () => {
        try {
          const res = await apiFetchAuthed('/api/coins')
          if (!res.ok) return
          const data = await res.json().catch(() => null)
          if (data && typeof data.balance === 'number') set({ coins: data.balance })
        } catch {
          // Offline / signed out — keep the cached value.
        }
      },

      // Attempt to spend coins for a style. Returns true if the server
      // debited and the style was unlocked, false otherwise.
      purchaseStyle: async (styleId, price) => {
        const state = get()
        if (state.ownedStyles.includes(styleId)) return false
        if (price > 0) {
          const result = await serverSpend(price)
          if (!result.ok) return false
          set({
            coins: result.balance,
            ownedStyles: [...state.ownedStyles, styleId],
          })
        } else {
          set({ ownedStyles: [...state.ownedStyles, styleId] })
        }
        return true
      },

      purchaseItem: async (itemId, price) => {
        const state = get()
        if (state.ownedItems.includes(itemId)) return false
        if (price > 0) {
          const result = await serverSpend(price)
          if (!result.ok) return false
          set({
            coins: result.balance,
            ownedItems: [...state.ownedItems, itemId],
          })
        } else {
          set({ ownedItems: [...state.ownedItems, itemId] })
        }
        return true
      },

      // Generic spend used by one-shot actions (e.g., avatar regen). Returns
      // the server's new balance on success, or null on failure.
      spendCoins: async (amount) => {
        if (!Number.isInteger(amount) || amount <= 0) return null
        const result = await serverSpend(amount)
        if (!result.ok) return null
        set({ coins: result.balance })
        return result.balance
      },

      isOwned: (itemId) => get().ownedItems.includes(itemId),
    }),
    { name: 'my-favorite-book-avatar' }
  )
)
