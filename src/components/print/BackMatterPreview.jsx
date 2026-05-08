// Renders a preview of the curated back-matter pages added to every printed
// book, so the user knows what they're paying for before they place the order.
// Mirrors the page sequence in lib/print/pdf-html.js#buildClosingPages —
// when that changes, update this list to match.
import { BookOpen, Heart, Users, MapPin, MessageCircle, Sparkles, FileText, Pencil } from 'lucide-react'

// Lulu floor for color print-on-demand. Same as MIN_INTERIOR_PAGES on the server.
const MIN_INTERIOR_PAGES = 32

export default function BackMatterPreview({ book }) {
  const storyPageCount = book?.pages?.length ?? 0
  const charCount = (book?.characters ?? []).length

  // Each entry mirrors one curated back-matter page from the PDF builder.
  // The setting page is conditional in the PDF builder; same here.
  const sections = [
    {
      icon: BookOpen,
      title: 'The End',
      desc: 'A title spread closing the story.',
    },
    {
      icon: Heart,
      title: 'Dedication',
      desc: 'A blank "This book is for…" page so the reader can fill in a name.',
    },
    {
      icon: FileText,
      title: 'About the Author',
      desc: book?.authorName
        ? `Spotlights ${book.authorName}, the storyteller.`
        : 'Spotlights the kid who wrote the book.',
    },
    {
      icon: Users,
      title: 'Meet the Characters',
      desc: charCount > 0
        ? `${charCount} character${charCount === 1 ? '' : 's'}, each with a name + emoji + short bio.`
        : 'A page introducing the heroes of the story.',
    },
  ]
  if (book?.setting) {
    sections.push({
      icon: MapPin,
      title: 'Where the story happens',
      desc: `Visualizes ${book.setting.name ?? book.setting.label ?? 'the setting'}.`,
    })
  }
  sections.push({
    icon: MessageCircle,
    title: 'Story Reflection',
    desc: '4 open-ended questions for the reader to think about.',
  })
  sections.push({
    icon: Sparkles,
    title: 'Make your own magical book',
    desc: 'A scan-to-download page sharing MyBookLab with whoever holds the book next.',
  })

  // Estimate how many notes / doodle padding pages will be appended.
  // Mirrors buildClosingPages: ceil to even, fill remainder with alternating pages.
  const curatedCount = sections.length
  const minTotal = Math.max(MIN_INTERIOR_PAGES, storyPageCount + curatedCount)
  const evenTotal = minTotal % 2 === 0 ? minTotal : minTotal + 1
  const padCount = Math.max(0, evenTotal - storyPageCount - curatedCount)
  const totalPages = storyPageCount + curatedCount + padCount

  return (
    <div className="rounded-xl border border-galaxy-text-muted/20 bg-galaxy-bg-light p-4 space-y-4">
      <div>
        <h3 className="font-heading text-sm font-bold text-galaxy-text">What else is in the printed book</h3>
        <p className="text-xs text-galaxy-text-muted mt-1">
          Every printed book includes these curated pages after your story
          {totalPages > 0 ? ` — ${totalPages} pages total` : ''}.
        </p>
      </div>

      <ul className="space-y-2">
        {sections.map((s, i) => (
          <li key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-galaxy-bg/40">
            <s.icon size={16} className="text-galaxy-primary mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-body text-sm font-semibold text-galaxy-text">{s.title}</p>
              <p className="text-xs text-galaxy-text-muted">{s.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      {padCount > 0 && (
        <div className="pt-3 border-t border-galaxy-text-muted/10">
          <div className="flex items-start gap-3 p-2 rounded-lg">
            <Pencil size={16} className="text-galaxy-text-muted mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-body text-sm font-semibold text-galaxy-text">
                {padCount} more {padCount === 1 ? 'page' : 'pages'} for notes &amp; doodles
              </p>
              <p className="text-xs text-galaxy-text-muted">
                Lined "Notes from your reader" pages and blank "Draw your own scene" doodle frames, alternating. Lulu requires at least {MIN_INTERIOR_PAGES} interior pages — these fill out the book and make it feel substantial.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
