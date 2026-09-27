import { useTranslation } from 'react-i18next'
import LicenseBadge from './LicenseBadge'

// The four "class at a glance" stat cards on the teacher dashboard (Task
// D2). Trial days left comes for free by reusing LicenseBadge, which
// already calls rosterText.js's trialDaysLeft internally — no second
// countdown to keep in sync with the server's own trial math.
function StatCard({ value, label, sub }) {
  return (
    <div className="glass rounded-2xl border border-galaxy-text-muted/10 p-4">
      <p className="font-heading text-2xl font-bold text-galaxy-text">{value}</p>
      <p className="mt-0.5 font-body text-xs text-galaxy-text-muted">{label}</p>
      {sub && <p className="mt-1 font-body text-[11px] text-galaxy-text-muted/70">{sub}</p>}
    </div>
  )
}

export default function ClassGlance({ classInfo, summary }) {
  const { t } = useTranslation()

  return (
    <section aria-labelledby="glance-heading" className="mb-8">
      <h2 id="glance-heading" className="mb-3 font-heading text-lg font-bold text-galaxy-text">
        {t('school:teacher.dashboard.glance.heading')}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          value={t('school:teacher.dashboard.glance.active_fraction', {
            active: summary.active_this_week,
            total: summary.total_students,
          })}
          label={t('school:teacher.dashboard.glance.active_label')}
        />
        <StatCard
          value={summary.books_total}
          label={t('school:teacher.dashboard.glance.books_label')}
          sub={t('school:teacher.dashboard.glance.books_edited_sub', { count: summary.books_edited_this_week })}
        />
        <StatCard
          value={t('school:teacher.dashboard.glance.pictures_fraction', {
            used: summary.images_used,
            allowance: summary.image_allowance,
          })}
          label={t('school:teacher.dashboard.glance.pictures_label')}
        />
        <div className="glass flex flex-col items-start justify-center rounded-2xl border border-galaxy-text-muted/10 p-4">
          <p className="mb-1.5 font-body text-xs text-galaxy-text-muted">{t('school:teacher.dashboard.glance.license_label')}</p>
          <LicenseBadge license={classInfo.license} />
        </div>
      </div>
    </section>
  )
}
