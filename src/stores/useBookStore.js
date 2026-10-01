import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { MAX_CHARACTERS } from '../data/characters'
import i18next from '../i18n'

const createBlankPage = (pageNumber) => ({
  id: nanoid(),
  pageNumber,
  text: '',
  illustrationData: null,
  illustrationRegenCount: 0,
  borderStyle: 'stars',
})

const createBlankBook = () => ({
  id: nanoid(),
  title: '',
  authorName: '',
  authorAge: 8,
  colors: {
    cover: '#8B5CF6',
    accent: '#06B6D4',
    text: '#F1F5F9',
    palette: 'starlight',
  },
  // The language the child writes in (iPad: BookDraftStore stamps the same
  // field): the printed back matter follows it, not the UI of whoever
  // later orders the print.
  language: (i18next.language || 'en').slice(0, 2),
  characters: [],
  setting: null,
  timePeriod: null,
  pages: [createBlankPage(1)],
  coverImage: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

export const useBookStore = create(
  persist(
    (set, get) => ({
      book: null,
      currentStep: 0,
      currentPageIndex: 0,

      // Daily image generation tracking (resets each day)
      imageGenerationsToday: 0,
      imageGenerationDate: null,

      getImageGenerationsToday: () => {
        const today = new Date().toDateString()
        const state = get()
        return state.imageGenerationDate === today ? state.imageGenerationsToday : 0
      },

      incrementImageGenerations: () => {
        const today = new Date().toDateString()
        const state = get()
        if (state.imageGenerationDate !== today) {
          set({ imageGenerationsToday: 1, imageGenerationDate: today })
        } else {
          set({ imageGenerationsToday: state.imageGenerationsToday + 1 })
        }
      },

      startNewBook: () =>
        set({ book: createBlankBook(), currentStep: 0, currentPageIndex: 0 }),

      loadBook: (book) =>
        set({ book, currentStep: 0, currentPageIndex: 0 }),

      // Schools Task S3: "Start writing" on an assignment card creates a
      // book the normal way (startNewBook, above) and then tags it with
      // this. assignmentId/assignmentPrompt live as plain fields on the
      // book object itself (the assignment's title is written straight
      // into the book's own `title` field below, not kept as a separate
      // field) — the SAME object addBook/updateBook already persist
      // (zustand persist) and push to /api/sync-books (useBookshelfStore's
      // syncBookToCloud), so the tag survives reloads for free rather than
      // needing its own storage or its own sync call. Never read by, or
      // sent to, anything other than this app's own UI (PreviewPage's
      // Hand-in flow) — in particular never sent to /api/school/submit
      // itself, which only takes {assignmentId, bookId} in the request
      // body, not the book blob.
      tagAssignment: ({ id, title, prompt }) =>
        set((state) => ({
          book: state.book
            ? {
                ...state.book,
                title: title ?? state.book.title,
                assignmentId: id,
                assignmentPrompt: prompt ?? null,
                updatedAt: new Date().toISOString(),
              }
            : null,
        })),

      setTitle: (title) =>
        set((state) => ({
          book: state.book ? { ...state.book, title, updatedAt: new Date().toISOString() } : null,
        })),

      setAuthor: (authorName, authorAge) =>
        set((state) => ({
          book: state.book
            ? { ...state.book, authorName, authorAge, updatedAt: new Date().toISOString() }
            : null,
        })),

      setColors: (colors) =>
        set((state) => ({
          book: state.book
            ? { ...state.book, colors: { ...state.book.colors, ...colors }, updatedAt: new Date().toISOString() }
            : null,
        })),

      addCharacter: (character) =>
        set((state) => ({
          book: state.book && state.book.characters.length < MAX_CHARACTERS
            ? {
                ...state.book,
                characters: [...state.book.characters, { ...character, id: character.id || nanoid() }],
                updatedAt: new Date().toISOString(),
              }
            : state.book,
        })),

      removeCharacter: (id) =>
        set((state) => ({
          book: state.book
            ? {
                ...state.book,
                characters: state.book.characters.filter((c) => c.id !== id),
                updatedAt: new Date().toISOString(),
              }
            : null,
        })),

      toggleCharacter: (character) =>
        set((state) => {
          if (!state.book) return {}
          const exists = state.book.characters.find((c) => c.id === character.id)
          if (!exists && state.book.characters.length >= MAX_CHARACTERS) return {}
          return {
            book: {
              ...state.book,
              characters: exists
                ? state.book.characters.filter((c) => c.id !== character.id)
                : [...state.book.characters, character],
              updatedAt: new Date().toISOString(),
            },
          }
        }),

      setSetting: (setting) =>
        set((state) => ({
          book: state.book
            ? { ...state.book, setting, updatedAt: new Date().toISOString() }
            : null,
        })),

      setTimePeriod: (timePeriod) =>
        set((state) => ({
          book: state.book
            ? { ...state.book, timePeriod, updatedAt: new Date().toISOString() }
            : null,
        })),

      addPage: () =>
        set((state) => {
          if (!state.book) return {}
          const newPage = createBlankPage(state.book.pages.length + 1)
          return {
            book: {
              ...state.book,
              pages: [...state.book.pages, newPage],
              updatedAt: new Date().toISOString(),
            },
            currentPageIndex: state.book.pages.length,
          }
        }),

      setCoverImage: (coverImage) =>
        set((state) => ({
          book: state.book
            ? {
                ...state.book,
                coverImage,
                // Reset regen counter when the user clears the cover; otherwise
                // count this as a regeneration. Same per-asset cap rationale
                // as page illustrations.
                coverRegenCount: coverImage == null
                  ? 0
                  : (state.book.coverRegenCount ?? 0) + 1,
                updatedAt: new Date().toISOString(),
              }
            : null,
        })),

      updatePageIllustration: (pageId, illustrationData) =>
        set((state) => ({
          book: state.book
            ? {
                ...state.book,
                pages: state.book.pages.map((p) =>
                  p.id === pageId
                    ? {
                        ...p,
                        illustrationData,
                        // Reset the per-page regen counter when the user clears
                        // the illustration; otherwise count this as a regen.
                        illustrationRegenCount: illustrationData == null
                          ? 0
                          : (p.illustrationRegenCount ?? 0) + 1,
                      }
                    : p
                ),
                updatedAt: new Date().toISOString(),
              }
            : null,
        })),

      updatePageText: (pageId, text) =>
        set((state) => ({
          book: state.book
            ? {
                ...state.book,
                pages: state.book.pages.map((p) =>
                  p.id === pageId ? { ...p, text } : p
                ),
                updatedAt: new Date().toISOString(),
              }
            : null,
        })),

      removePage: (pageId) =>
        set((state) => {
          if (!state.book || state.book.pages.length <= 1) return {}
          const newPages = state.book.pages
            .filter((p) => p.id !== pageId)
            .map((p, i) => ({ ...p, pageNumber: i + 1 }))
          return {
            book: { ...state.book, pages: newPages, updatedAt: new Date().toISOString() },
            currentPageIndex: Math.min(state.currentPageIndex, newPages.length - 1),
          }
        }),

      reorderPages: (fromIndex, toIndex) =>
        set((state) => {
          if (!state.book) return {}
          const pages = [...state.book.pages]
          const [moved] = pages.splice(fromIndex, 1)
          pages.splice(toIndex, 0, moved)
          const renumbered = pages.map((p, i) => ({ ...p, pageNumber: i + 1 }))
          return {
            book: { ...state.book, pages: renumbered, updatedAt: new Date().toISOString() },
          }
        }),

      setCurrentPageIndex: (index) => set({ currentPageIndex: index }),
      nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),
      prevStep: () => set((state) => ({ currentStep: Math.max(0, state.currentStep - 1) })),
      setStep: (step) => set({ currentStep: step }),

      resetBook: () => set({ book: null, currentStep: 0, currentPageIndex: 0 }),
    }),
    {
      name: 'my-favorite-book-current',
    }
  )
)
