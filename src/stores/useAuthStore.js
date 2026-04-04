import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,

  initialize: async () => {
    if (!supabase) { set({ loading: false }); return }
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    set({ user, loading: false })
    if (user) {
      const { useBookshelfStore } = await import('./useBookshelfStore')
      useBookshelfStore.getState().loadCloudBooks(user.id)
    }
    supabase.auth.onAuthStateChange(async (_event, session) => {
      const newUser = session?.user ?? null
      set({ user: newUser })
      if (newUser) {
        const { useBookshelfStore } = await import('./useBookshelfStore')
        useBookshelfStore.getState().loadCloudBooks(newUser.id)
      }
    })
  },

  // metadata: { role: 'student' | 'teacher', display_name: string }
  signUp: async (email, password, metadata = {}) => {
    if (!supabase) throw new Error('Auth not configured')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    })
    if (error) throw error
    return data
  },

  signIn: async (email, password) => {
    if (!supabase) throw new Error('Auth not configured')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  signOut: async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    set({ user: null })
  },
}))

// Selector helpers
export const selectDisplayName = (s) =>
  s.user?.user_metadata?.display_name || s.user?.email?.split('@')[0] || null

export const selectRole = (s) =>
  s.user?.user_metadata?.role ?? null
