import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useSettingsStore = create(
  persist(
    (set) => ({
      apiKey: '',
      togetherApiKey: '',
      setApiKey: (apiKey) => set({ apiKey }),
      setTogetherApiKey: (togetherApiKey) => set({ togetherApiKey }),
    }),
    {
      name: 'my-favorite-book-settings',
    }
  )
)
