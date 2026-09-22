// Renders a preview of the curated back-matter pages added to every printed
// book, so the user knows what they're paying for before they place the order.
// Mirrors the page sequence in lib/print/pdf-html.js#buildClosingPages —
// when that changes, update this list to match.
import { BookOpen, Heart, Users, MapPin, MessageCircle, Sparkles, FileText, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Lulu floor for color print-on-demand. Same as MIN_INTERIOR_PAGES on the server.
const MIN_INTERIOR_PAGES = 32

export default function BackMatterPreview({ book }) {
  const { t } = useTranslation()
  const storyPageCount = book?.pages?.length ?? 0
  const charCount = (book?.characters ?? []).length

  // Each entry mirrors one curated back-matter page from the PDF builder.
  // The setting page is conditional in the PDF builder; same here.
  const sections = [
    {
      icon: BookOpen,
      title: t('print:book.the_end'),
      desc: t('print:back_matter.the_end_desc'),
    },
    {
      icon: Heart,
      title: t('print:back_matter.dedication_title'),
      desc: t('print:back_matter.dedication_desc'),
    },
    {
      icon: FileText,
      title: t('print:back_matter.about_author_title'),
      // Two whole sentences rather than a name spliced into a shared stem —
      // the word order around the name differs per language.
      desc: book?.authorName
        ? t('print:back_matter.about_author_desc', { name: book.authorName })
        : t('print:back_matter.about_author_desc_generic'),
    },
    {
      icon: Users,
      title: t('print:back_matter.characters_title'),
      desc: charCount > 0
        ? t('print:back_matter.characters_desc', { count: charCount })
        : t('print:back_matter.characters_desc_generic'),
    },
  ]
  if (book?.setting) {
    const settingName = book.setting.name ?? book.setting.label
    sections.push({
      icon: MapPin,
      title: t('print:back_matter.setting_title'),
      desc: settingName
        ? t('print:back_matter.setting_desc', { name: settingName })
        : t('print:back_matter.setting_desc_generic'),
    })
  }
  sections.push({
    icon: MessageCircle,
    title: t('print:back_matter.reflection_title'),
    desc: t('print:back_matter.reflection_desc'),
  })
  sections.push({
    icon: Sparkles,
    title: t('print:back_matter.share_title'),
    desc: t('print:back_matter.share_desc'),
  })

  // Estimate how many notes / doodle padding pages will be appended.
  // Mirrors buildClosingPages: ceil to even, fill remainder with alternating pages.
  const curatedCount = sections.length
  const minTotal = Math.max(MIN_INTERIOR_PAGES, storyPageCount + curatedCount)
  const evenTotal = minTotal % 2 === 0 ? minTotal : minTotal + 1
  const padCount = Math.max(0, evenTotal - storyPageCount - curatedCount)
  const totalPages = storyPageCount + curatedCount + padCount

  return (
    <div className="rounded-xl border border-galaxy-text-muted/20 glass p-4 space-y-4">
      <div>
        <h3 className="font-heading text-sm font-bold text-galaxy-text">{t('print:back_matter.title')}</h3>
        <p className="text-xs text-galaxy-text-muted mt-1">
          {totalPages > 0
            ? t('print:back_matter.subtitle_with_total', { count: totalPages })
            : t('print:back_matter.subtitle')}
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
                {t('print:back_matter.padding_title', { count: padCount })}
              </p>
              <p className="text-xs text-galaxy-text-muted">
                {t('print:back_matter.padding_desc', { min: MIN_INTERIOR_PAGES })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
