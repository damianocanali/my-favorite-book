import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAccessibilityStore = create(
  persist(
    (set) => ({
      dyslexiaFont: false,
      focusMode: false,
      toggleDyslexiaFont: () => set((s) => ({ dyslexiaFont: !s.dyslexiaFont })),
      toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
      setFocusMode: (val) => set({ focusMode: val }),
    }),
    { name: 'my-favorite-book-accessibility' }
  )
)
