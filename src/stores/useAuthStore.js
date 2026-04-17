import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useBookshelfStore, setBookshelfUserId } from './useBookshelfStore'
import { useAvatarStore } from './useAvatarStore'
import { Capacitor } from '@capacitor/core'

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,

  initialize: async () => {
    if (!supabase) { set({ loading: false }); return }
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    set({ user, loading: false })
    if (user) {
      setBookshelfUserId(user.id)
      useBookshelfStore.getState().loadCloudBooks(user.id)
      useAvatarStore.getState().refreshCoins()
    }
    supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null
      set({ user: newUser })
      setBookshelfUserId(newUser?.id ?? null)
      if (newUser) {
        useBookshelfStore.getState().loadCloudBooks(newUser.id)
        useAvatarStore.getState().refreshCoins()
      }
    })
  },

  signUp: async (email, password, metadata = {}) => {
    if (!supabase) throw new Error('Auth not configured')
    const redirectTo = Capacitor.isNativePlatform()
      ? 'com.myfavoritebook.app://auth/callback'
      : `${window.location.origin}/auth/callback`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata, emailRedirectTo: redirectTo },
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
    setBookshelfUserId(null)
    set({ user: null })
  },
}))

// Selector helpers
export const selectDisplayName = (s) =>
  s.user?.user_metadata?.display_name || s.user?.email?.split('@')[0] || null

export const selectRole = (s) =>
  s.user?.user_metadata?.role ?? null
