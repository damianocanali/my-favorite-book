import { useTranslation } from 'react-i18next'
import { relativeTime } from './relativeTime'
import FeelingIcon from './FeelingIcon'

// The teacher dashboard's roster (Task D2): a table on sm+ screens, cards
// on phones, per the brief. No feeling totals, no sorting by feelings, no
// scores anywhere (owner decision D7) — check-ins are just small coloured
// icons, one per entry, oldest to newest.
function Avatar({ student }) {
  if (student.avatar_url) {
    return (
      <img
        src={student.avatar_url}
        alt=""
        aria-hidden="true"
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-galaxy-secondary/15 text-lg"
    >
      {student.avatar_emoji ?? '🙂'}
    </span>
  )
}

function InactiveChip() {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center rounded-full border border-galaxy-text-muted/20 px-2 py-0.5 font-body text-[11px] font-semibold text-galaxy-text-muted">
      {t('school:teacher.dashboard.students.inactive_chip')}
    </span>
  )
}

function CheckinIcons({ checkins, locale }) {
  const { t } = useTranslation()
  if (!checkins.length) {
    return <span className="font-body text-xs text-galaxy-text-muted">{t('school:teacher.dashboard.students.no_checkins')}</span>
  }
  return (
    <div className="flex items-center gap-1">
      {checkins.map((c, i) => {
        const label = [
          t(`checkin:feeling.${c.feeling}`),
          c.need ? t(`checkin:need.${c.need}`) : null,
          relativeTime(c.created_at, locale),
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <span key={i} role="img" aria-label={label} title={label}>
            <FeelingIcon id={c.feeling} size={18} />
          </span>
        )
      })}
    </div>
  )
}

function BooksCell({ student, locale }) {
  const { t } = useTranslation()
  return (
    <>
      {t('school:teacher.dashboard.students.books_count', { count: student.books_count })}
      {student.last_book_edited_at && (
        <span className="block text-xs opacity-70">
          {t('school:teacher.dashboard.students.last_edited', { when: relativeTime(student.last_book_edited_at, locale) })}
        </span>
      )}
    </>
  )
}

export default function StudentsTable({ students, locale, onOpen }) {
  const { t } = useTranslation()

  if (students.length === 0) {
    return <p className="py-8 text-center font-body text-sm text-galaxy-text-muted">{t('school:teacher.dashboard.students.empty')}</p>
  }

  return (
    <>
      {/* Table — sm and up */}
      <table className="hidden w-full border-collapse text-left sm:table">
        <thead>
          <tr className="font-body text-xs font-semibold uppercase tracking-wide text-galaxy-text-muted">
            <th className="pb-2 pr-3">{t('school:teacher.dashboard.students.col_name')}</th>
            <th className="pb-2 pr-3">{t('school:teacher.dashboard.students.col_last_sign_in')}</th>
            <th className="pb-2 pr-3">{t('school:teacher.dashboard.students.col_books')}</th>
            <th className="pb-2 pr-3">{t('school:teacher.dashboard.students.col_pictures_today')}</th>
            <th className="pb-2">{t('school:teacher.dashboard.students.col_checkins')}</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr
              key={s.id}
              tabIndex={0}
              onClick={() => onOpen(s)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpen(s)
                }
              }}
              aria-label={t('school:teacher.dashboard.students.open_aria', { name: s.display_name })}
              className="cursor-pointer border-t border-galaxy-text-muted/10 transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-galaxy-primary"
            >
              <td className="py-3 pr-3">
                <span className="flex items-center gap-2">
                  <Avatar student={s} />
                  <span className="min-w-0">
                    <span className="block truncate font-body font-semibold text-galaxy-text">{s.display_name}</span>
                    {s.inactive_7d && <InactiveChip />}
                  </span>
                </span>
              </td>
              <td className="py-3 pr-3 font-body text-sm text-galaxy-text-muted">
                {s.last_sign_in_at ? relativeTime(s.last_sign_in_at, locale) : t('school:teacher.roster.last_sign_in_never')}
              </td>
              <td className="py-3 pr-3 font-body text-sm text-galaxy-text-muted">
                <BooksCell student={s} locale={locale} />
              </td>
              <td className="py-3 pr-3 font-body text-sm text-galaxy-text-muted">{s.images_today}</td>
              <td className="py-3">
                <CheckinIcons checkins={s.checkins_7d} locale={locale} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Cards — phones */}
      <ul className="space-y-3 sm:hidden">
        {students.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpen(s)}
              aria-label={t('school:teacher.dashboard.students.open_aria', { name: s.display_name })}
              className="glass w-full rounded-2xl border border-galaxy-text-muted/10 p-4 text-left transition-colors hover:border-galaxy-secondary/40"
            >
              <div className="mb-2 flex items-center gap-3">
                <Avatar student={s} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body font-semibold text-galaxy-text">{s.display_name}</p>
                  <p className="font-body text-xs text-galaxy-text-muted">
                    {s.last_sign_in_at ? relativeTime(s.last_sign_in_at, locale) : t('school:teacher.roster.last_sign_in_never')}
                  </p>
                </div>
                {s.inactive_7d && <InactiveChip />}
              </div>
              <div className="flex items-center justify-between gap-2 font-body text-xs text-galaxy-text-muted">
                <span>{t('school:teacher.dashboard.students.books_count', { count: s.books_count })}</span>
                <span>{t('school:teacher.dashboard.students.pictures_today', { count: s.images_today })}</span>
              </div>
              <div className="mt-2">
                <CheckinIcons checkins={s.checkins_7d} locale={locale} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
