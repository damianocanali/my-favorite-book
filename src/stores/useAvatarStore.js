import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFetchAuthed } from '../lib/api'
import { supabase } from '../lib/supabase'

// The coin balance is authoritative on the server. We mirror it in the store
// so the UI can read it synchronously, but every mutation goes through the
// server — refreshCoins to pull, spendCoins to atomically debit. The
// persisted value is only a warm-start hint; fetchCoins reconciles it on
// load.

async function serverSpend(amount, kind, id) {
  const res = await apiFetchAuthed('/api/spend-coins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // kind/id let the server grant ownership in the same transaction as
    // the debit — ownership used to be recorded only in localStorage, so
    // it was forgeable and invisible on the user's other devices.
    body: JSON.stringify({ amount, kind, id }),
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

      /**
       * Generated avatars now come back as a Storage URL, so persist it to
       * `user_inventory` and the picture follows the account to the phone.
       * A base64 data URL (the fallback when Storage is unavailable) stays
       * local — it's too big for the row and can't be shared anyway.
       */
      setAvatarImage: (image) => {
        set({ avatarImage: image })
        if (!supabase || typeof image !== 'string' || !/^https?:\/\//i.test(image)) return
        supabase.auth.getUser().then(({ data }) => {
          const userId = data?.user?.id
          if (!userId) return
          // Column privileges allow a client to write avatar_url only —
          // owned styles/items remain server-owned.
          supabase
            .from('user_inventory')
            .upsert({ user_id: userId, avatar_url: image }, { onConflict: 'user_id' })
            .then(() => {})
        })
      },

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
      /**
       * Pull owned styles/items and the avatar from `user_inventory`.
       *
       * These were localStorage-only, so the same account showed a
       * different avatar and different purchases on each device, and
       * clearing site data looked like losing things the user paid for.
       * Local values are unioned with the server's rather than replaced,
       * so a purchase made moments ago can't blink out on a racing read.
       */
      loadInventory: async () => {
        if (!supabase) return
        const { data, error } = await supabase
          .from('user_inventory')
          .select('avatar_url,owned_styles,owned_items')
          .maybeSingle()
        if (error || !data) return
        set((state) => ({
          ownedStyles: [...new Set([...state.ownedStyles, ...(data.owned_styles ?? [])])],
          ownedItems: [...new Set([...state.ownedItems, ...(data.owned_items ?? [])])],
          avatarImage: data.avatar_url || state.avatarImage,
        }))
      },

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
          const result = await serverSpend(price, 'style', styleId)
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
          const result = await serverSpend(price, 'item', itemId)
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
