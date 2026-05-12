// React versions of the curated back-matter pages that the print pipeline
// generates in lib/print/pdf-html.js. Used inside <BookPreview> when the
// caller asks to include back matter, so the user can flip through their
// whole printed book — story + extras — exactly as it'll arrive.
//
// Visual style mirrors the print HTML. Page count + ordering also mirror
// buildClosingPages() so what the user flips through here matches what
// ships. If you change one, change both.
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

const APP_INSTAGRAM_HANDLE = '@mybooklab.app'
const APP_STORE_URL = 'https://apps.apple.com/us/app/my-book-lab/id6761641708'
const APP_WEBSITE = 'mybooklab.app'
const APP_PLATFORMS = 'iPhone · iPad · Mac'
const MIN_INTERIOR_PAGES = 32

export function TheEndPage({ book }) {
  const cover = book.colors?.cover ?? '#8B5CF6'
  const accent = book.colors?.accent ?? '#06B6D4'
  const textColor = book.colors?.text ?? '#F1F5F9'
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center text-center px-6"
      style={{
        background: `linear-gradient(135deg, ${accent}, ${cover})`,
        color: textColor,
      }}
    >
      <p className="font-heading font-bold text-5xl sm:text-6xl mb-3">The End</p>
      <p className="font-body text-lg opacity-90">{book.title}</p>
      <p className="font-body text-sm opacity-75 mt-1">
        Written and illustrated by {book.authorName}
      </p>
    </div>
  )
}

export function DedicationPage({ book }) {
  const cover = book.colors?.cover ?? '#8B5CF6'
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center text-center px-8"
      style={{ background: 'linear-gradient(180deg, white, #FFF8F0)' }}
    >
      <p className="font-heading font-bold text-2xl mb-1" style={{ color: cover }}>
        Dedication
      </p>
      <p className="font-body text-sm opacity-75 mb-4">This book is for…</p>
      <div className="w-full max-w-xs space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b border-slate-400 h-4" />
        ))}
      </div>
      <p className="font-body italic text-xs opacity-50 mt-4">
        (write the name of someone special)
      </p>
    </div>
  )
}

export function AboutAuthorPage({ book }) {
  const cover = book.colors?.cover ?? '#8B5CF6'
  const dateStr = new Date(book.createdAt ?? Date.now()).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const ageLine = book.authorAge ? `, age ${book.authorAge}` : ''
  return (
    <div className="w-full h-full bg-white flex flex-col items-center justify-center text-center px-6 gap-3">
      <p className="font-heading font-bold text-xl" style={{ color: cover }}>
        About the Author
      </p>
      {book.authorAvatar ? (
        <img
          src={book.authorAvatar}
          alt=""
          className="w-32 h-32 rounded-full object-cover shadow-lg"
        />
      ) : (
        <div
          className="w-32 h-32 rounded-full flex items-center justify-center text-5xl text-white"
          style={{ background: cover }}
        >
          {book.characters?.[0]?.emoji ?? '✨'}
        </div>
      )}
      <p className="font-body font-bold text-lg">
        {book.authorName}{ageLine}
      </p>
      <p className="font-body text-xs opacity-70">Created on {dateStr}</p>
      <p className="font-body text-xs opacity-60 mt-3 max-w-xs">
        Every great storyteller starts somewhere. Thank you for sharing your imagination.
      </p>
    </div>
  )
}

export function CharacterGalleryPage({ book }) {
  const cover = book.colors?.cover ?? '#8B5CF6'
  const accent = book.colors?.accent ?? '#06B6D4'
  const characters = book.characters ?? []
  if (characters.length === 0) {
    return (
      <div className="w-full h-full bg-white flex flex-col items-center justify-center text-center px-6">
        <p className="font-heading font-bold text-xl" style={{ color: cover }}>
          Characters
        </p>
        <p className="text-6xl my-3">📖</p>
        <p className="font-body text-sm opacity-70">
          Meet the brave heroes of this story.
        </p>
      </div>
    )
  }
  const isSingle = characters.length === 1
  return (
    <div className="w-full h-full bg-white flex flex-col px-4 py-6 overflow-hidden">
      <p
        className="font-heading font-bold text-xl text-center mb-4"
        style={{ color: cover }}
      >
        Meet the Characters
      </p>
      <div
        className={
          isSingle
            ? 'flex-1 flex justify-center items-center'
            : 'flex-1 grid grid-cols-2 gap-3 content-start'
        }
      >
        {characters.map((c) => (
          <div
            key={c.id}
            className="flex flex-col items-center gap-1 p-3 rounded-lg"
            style={{ background: `${accent}1A` }}
          >
            <div className="text-4xl">{c.emoji ?? '✨'}</div>
            <p className="font-body font-bold text-sm">{c.name ?? 'A hero'}</p>
            {c.description && (
              <p className="font-body text-xs opacity-70 text-center">
                {c.description.slice(0, 80)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function AboutSettingPage({ book }) {
  const cover = book.colors?.cover ?? '#8B5CF6'
  const accent = book.colors?.accent ?? '#06B6D4'
  const setting = book.setting
  if (!setting) return null
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center text-center px-6"
      style={{ background: `linear-gradient(135deg, ${accent}10, ${cover}10)` }}
    >
      <p className="font-heading font-bold text-xl" style={{ color: cover }}>
        Where the story happens
      </p>
      <div className="text-7xl my-4">{setting.emoji ?? '🌍'}</div>
      <p className="font-body font-bold text-lg">
        {setting.name ?? setting.label ?? 'A magical place'}
      </p>
      {setting.description && (
        <p className="font-body text-sm opacity-75 max-w-xs mt-3">
          {setting.description}
        </p>
      )}
    </div>
  )
}

export function ReflectionPage({ book }) {
  const cover = book.colors?.cover ?? '#8B5CF6'
  const questions = [
    'Who was your favorite character, and why?',
    'What was the funniest moment in the story?',
    'If you could change one thing in the story, what would it be?',
    'What do you think happens after the story ends?',
  ]
  return (
    <div className="w-full h-full bg-white flex flex-col px-4 py-6 overflow-hidden">
      <p
        className="font-heading font-bold text-xl text-center mb-1"
        style={{ color: cover }}
      >
        Story Reflection
      </p>
      <p className="font-body text-xs opacity-65 text-center mb-3">
        For the reader to think about, talk about, or write about.
      </p>
      <div className="flex flex-col gap-2 max-w-md mx-auto w-full">
        {questions.map((q, i) => (
          <div
            key={i}
            className="p-3 rounded"
            style={{ background: `${cover}10`, borderLeft: `3px solid ${cover}` }}
          >
            <p className="font-body text-sm">
              <strong>{i + 1}.</strong> {q}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PromoPage() {
  const [qrUrl, setQrUrl] = useState(null)
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(APP_STORE_URL, {
      margin: 1,
      width: 320,
      color: { dark: '#1E293B', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrUrl(url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center text-center px-6"
      style={{ background: 'linear-gradient(135deg, #FFF4E5, #FFE9F5)' }}
    >
      <p
        className="font-heading font-bold text-2xl mb-1"
        style={{ color: '#8B5CF6' }}
      >
        Make your own magical book
      </p>
      <p className="font-body text-sm opacity-80 max-w-xs mb-4">
        MyBookLab lets kids dream up stories, illustrate them with AI, and order them as
        real, printed books.
      </p>
      {qrUrl ? (
        <img src={qrUrl} alt="" className="w-28 h-28 bg-white p-1 rounded shadow" />
      ) : (
        <div className="w-28 h-28 bg-slate-100 rounded shadow" />
      )}
      <p className="font-body text-xs opacity-65 mt-2">Scan to download</p>
      <p className="font-body text-xs opacity-60 tracking-wide mt-1">{APP_PLATFORMS}</p>
      <div className="flex gap-4 items-center justify-center mt-4">
        <p
          className="font-body text-sm font-bold"
          style={{ color: '#8B5CF6' }}
        >
          {APP_WEBSITE}
        </p>
        <span className="opacity-30">·</span>
        <p
          className="font-body text-sm font-bold"
          style={{ color: '#8B5CF6' }}
        >
          {APP_INSTAGRAM_HANDLE}
        </p>
      </div>
    </div>
  )
}

export function NotesFromReaderPage() {
  return (
    <div className="w-full h-full bg-white flex flex-col px-4 py-6">
      <p
        className="font-heading font-bold text-lg text-center mb-3"
        style={{ color: '#8B5CF6' }}
      >
        Notes from your reader
      </p>
      <div className="flex-1 flex flex-col justify-center gap-5 max-w-md mx-auto w-full">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b border-slate-400 h-3" />
        ))}
      </div>
    </div>
  )
}

export function DoodlePage() {
  return (
    <div className="w-full h-full bg-white flex flex-col items-center px-4 py-6">
      <p
        className="font-heading font-bold text-lg text-center mb-3"
        style={{ color: '#8B5CF6' }}
      >
        Draw your own scene
      </p>
      <div className="flex-1 w-full max-w-md border-2 border-dashed border-slate-300 rounded-2xl" />
    </div>
  )
}

export function buildBackMatterPages(book) {
  const items = [
    { Component: TheEndPage, key: 'end' },
    { Component: DedicationPage, key: 'dedication' },
    { Component: AboutAuthorPage, key: 'author' },
    { Component: CharacterGalleryPage, key: 'characters' },
  ]
  if (book.setting) items.push({ Component: AboutSettingPage, key: 'setting' })
  items.push(
    { Component: ReflectionPage, key: 'reflection' },
    { Component: PromoPage, key: 'promo' }
  )

  const storyPageCount = book.pages?.length ?? 0
  const requiredTotal = Math.max(MIN_INTERIOR_PAGES, storyPageCount + items.length)
  const evenTotal = requiredTotal % 2 === 0 ? requiredTotal : requiredTotal + 1
  const padCount = Math.max(0, evenTotal - storyPageCount - items.length)
  for (let i = 0; i < padCount; i++) {
    items.push({
      Component: i % 2 === 0 ? NotesFromReaderPage : DoodlePage,
      key: `pad-${i}`,
    })
  }
  return items
}
