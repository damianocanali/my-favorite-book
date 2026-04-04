import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFetch } from '../lib/api'

export const useBookshelfStore = create(
  persist(
    (set, get) => ({
      books: [],
      syncing: false,
      lastSyncedAt: null,

      addBook: (book) => {
        const updated = { ...book, updatedAt: new Date().toISOString() }
        set((state) => ({ books: [...state.books, updated] }))
        get()._syncBook(updated)
      },

      removeBook: (id) => {
        set((state) => ({ books: state.books.filter((b) => b.id !== id) }))
        get()._deleteCloudBook(id)
      },

      getBook: (id) => get().books.find((b) => b.id === id),

      updateBook: (id, updates) => {
        const now = new Date().toISOString()
        set((state) => ({
          books: state.books.map((b) =>
            b.id === id ? { ...b, ...updates, updatedAt: now } : b
          ),
        }))
        const book = get().books.find((b) => b.id === id)
        if (book) get()._syncBook(book)
      },

      // Fetch books from cloud and merge with local
      loadCloudBooks: async (userId) => {
        if (!userId) return
        set({ syncing: true })
        try {
          const res = await apiFetch(`/api/sync-books?userId=${userId}`)
          if (!res.ok) return
          const cloudBooks = await res.json()

          set((state) => {
            const localMap = new Map(state.books.map((b) => [b.id, b]))
            let merged = [...state.books]

            for (const row of cloudBooks) {
              const cloudBook = row.book_data
              const local = localMap.get(row.book_id)

              if (!local) {
                // Book exists in cloud but not locally — add it
                // Mark images as needing re-fetch since we stripped them
                merged.push(cloudBook)
              } else {
                // Both exist — keep the newer one
                const cloudTime = new Date(row.updated_at).getTime()
                const localTime = new Date(local.updatedAt || 0).getTime()
                if (cloudTime > localTime) {
                  // Cloud is newer — merge but keep local images
                  merged = merged.map((b) =>
                    b.id === row.book_id
                      ? {
                          ...cloudBook,
                          coverImage: local.coverImage || cloudBook.coverImage,
                          pages: cloudBook.pages?.map((p, i) => ({
                            ...p,
                            illustrationData:
                              local.pages?.[i]?.illustrationData || p.illustrationData,
                          })),
                        }
                      : b
                  )
                }
              }
            }

            return { books: merged, lastSyncedAt: new Date().toISOString() }
          })

          // Push any local-only books to cloud
          const cloudIds = new Set(cloudBooks.map((r) => r.book_id))
          const localOnly = get().books.filter((b) => !cloudIds.has(b.id))
          for (const book of localOnly) {
            get()._syncBook(book)
          }
        } catch {
          // Silent fail — local books still work
        } finally {
          set({ syncing: false })
        }
      },

      // Internal: sync a single book to cloud
      _syncBook: async (book) => {
        const { useAuthStore } = await import('./useAuthStore')
        const user = useAuthStore.getState().user
        if (!user) return
        try {
          await apiFetch('/api/sync-books', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, book }),
          })
        } catch {
          // Silent fail
        }
      },

      // Internal: delete a book from cloud
      _deleteCloudBook: async (bookId) => {
        const { useAuthStore } = await import('./useAuthStore')
        const user = useAuthStore.getState().user
        if (!user) return
        try {
          await apiFetch('/api/sync-books', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, bookId }),
          })
        } catch {
          // Silent fail
        }
      },
    }),
    {
      name: 'my-favorite-book-shelf',
      partialize: (state) => ({
        books: state.books,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
)
