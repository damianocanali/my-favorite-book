import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFetch } from '../lib/api'

// userId is set externally by useAuthStore on login
let _currentUserId = null
export function setBookshelfUserId(userId) {
  _currentUserId = userId
}

export const useBookshelfStore = create(
  persist(
    (set, get) => ({
      books: [],
      deletedBookIds: [],
      syncing: false,
      lastSyncedAt: null,

      addBook: (book) => {
        const updated = { ...book, updatedAt: new Date().toISOString() }
        set((state) => ({ books: [...state.books, updated] }))
        syncBookToCloud(updated)
      },

      removeBook: (id) => {
        set((state) => ({
          books: state.books.filter((b) => b.id !== id),
          deletedBookIds: [...state.deletedBookIds, id],
        }))
        deleteCloudBook(id)
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
        if (book) syncBookToCloud(book)
      },

      loadCloudBooks: async (userId) => {
        if (!userId) return
        set({ syncing: true })
        try {
          const res = await apiFetch(`/api/sync-books?userId=${userId}`)
          if (!res.ok) return
          const cloudBooks = await res.json()

          set((state) => {
            const localMap = new Map(state.books.map((b) => [b.id, b]))
            const deletedSet = new Set(state.deletedBookIds)
            let merged = [...state.books]

            for (const row of cloudBooks) {
              const cloudBook = row.book_data
              const local = localMap.get(row.book_id)

              // Skip books the user has deleted locally
              if (deletedSet.has(row.book_id)) continue

              if (!local) {
                merged.push(cloudBook)
              } else {
                const cloudTime = new Date(row.updated_at).getTime()
                const localTime = new Date(local.updatedAt || 0).getTime()
                if (cloudTime > localTime) {
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
            syncBookToCloud(book)
          }

          // Delete cloud books that were deleted locally on another platform
          const deletedSet = new Set(get().deletedBookIds)
          for (const cloudBook of cloudBooks) {
            if (deletedSet.has(cloudBook.book_id)) {
              deleteCloudBook(cloudBook.book_id)
            }
          }
        } catch {
          // Silent fail — local books still work
        } finally {
          set({ syncing: false })
        }
      },
    }),
    {
      name: 'my-favorite-book-shelf',
      partialize: (state) => ({
        books: state.books,
        deletedBookIds: state.deletedBookIds,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
)

// Standalone sync functions — no circular imports
async function syncBookToCloud(book) {
  if (!_currentUserId) return
  try {
    await apiFetch('/api/sync-books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: _currentUserId, book }),
    })
  } catch {
    // Silent fail
  }
}

async function deleteCloudBook(bookId) {
  if (!_currentUserId) return
  try {
    await apiFetch('/api/sync-books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', userId: _currentUserId, bookId }),
    })
  } catch {
    // Silent fail
  }
}
