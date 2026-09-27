import { useTranslation } from 'react-i18next'
import { GraduationCap } from 'lucide-react'
import { groupHelp } from '../../lib/dashboardHelp'
import { relativeTime } from './relativeTime'

// The "Needs you now" strip at the top of the teacher dashboard (Task D2):
// unseen help asks across every class this teacher owns (owner decision D7
// — teachers see every class check-in-triggered ask, the child is told).
// Grownup asks ("I need a grown-up") are styled urgent and always listed
// first; "Help with my book" asks are the calmer, secondary list. Neither
// list ever shows a score or a ranking — just who, which class, and when.
function HelpRow({ item, urgent, onSeen, locale }) {
  const { t } = useTranslation()
  const name = item.display_name ?? t('school:teacher.dashboard.needs_you_now.unknown_student')

  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
        urgent ? 'border-ios-red/30 bg-ios-red/10' : 'glass border-galaxy-text-muted/10'
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {urgent && <GraduationCap size={16} className="shrink-0 text-ios-red" aria-hidden="true" />}
        <div className="min-w-0">
          <p className="truncate font-body font-semibold text-galaxy-text">{name}</p>
          <p className="truncate font-body text-xs text-galaxy-text-muted">
            {item.class_name ? `${item.class_name} · ` : ''}
            {relativeTime(item.created_at, locale)}
            {item.asks > 1 ? ` · ${t('school:teacher.dashboard.needs_you_now.asks', { count: item.asks })}` : ''}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onSeen(item)}
        aria-label={t('school:teacher.dashboard.needs_you_now.seen_aria', { name })}
        className="shrink-0 rounded-full border border-galaxy-text-muted/30 px-3 py-1.5 font-body text-xs font-semibold text-galaxy-text-muted transition-colors hover:border-galaxy-text-muted/60 hover:text-galaxy-text"
      >
        {t('school:teacher.dashboard.needs_you_now.seen')}
      </button>
    </li>
  )
}

export default function NeedsYouNow({ help, onSeen, locale }) {
  const { t } = useTranslation()
  const { grownup, book } = groupHelp(help)

  return (
    <section aria-labelledby="needs-you-now-heading" className="mb-8">
      <h2 id="needs-you-now-heading" className="font-heading text-lg font-bold text-galaxy-text mb-1">
        {t('school:teacher.dashboard.needs_you_now.heading')}
      </h2>
      <p className="mb-3 font-body text-xs text-galaxy-text-muted">
        {t('school:teacher.dashboard.needs_you_now.disclaimer')}
      </p>

      {help.length === 0 ? (
        <p className="glass rounded-xl border border-galaxy-text-muted/10 p-4 font-body text-sm text-galaxy-text-muted">
          {t('school:teacher.dashboard.needs_you_now.empty')}
        </p>
      ) : (
        <div className="space-y-4">
          {grownup.length > 0 && (
            <div>
              <h3 className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-ios-red">
                {t('school:teacher.dashboard.needs_you_now.grownup_heading')}
              </h3>
              <ul className="space-y-2">
                {grownup.map((item) => (
                  <HelpRow key={item.id} item={item} urgent onSeen={onSeen} locale={locale} />
                ))}
              </ul>
            </div>
          )}
          {book.length > 0 && (
            <div>
              <h3 className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-galaxy-text-muted">
                {t('school:teacher.dashboard.needs_you_now.book_heading')}
              </h3>
              <ul className="space-y-2">
                {book.map((item) => (
                  <HelpRow key={item.id} item={item} onSeen={onSeen} locale={locale} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
