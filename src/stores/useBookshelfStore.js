import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useBookshelfStore = create(
  persist(
    (set, get) => ({
      books: [],

      addBook: (book) =>
        set((state) => ({
          books: [...state.books, { ...book, updatedAt: new Date().toISOString() }],
        })),

      removeBook: (id) =>
        set((state) => ({
          books: state.books.filter((b) => b.id !== id),
        })),

      getBook: (id) => get().books.find((b) => b.id === id),

      updateBook: (id, updates) =>
        set((state) => ({
          books: state.books.map((b) =>
            b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
          ),
        })),
    }),
    {
      name: 'my-favorite-book-shelf',
    }
  )
)
