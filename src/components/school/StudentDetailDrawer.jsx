import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StudentBooks from './StudentBooks'
import StudentCheckIns from './StudentCheckIns'

// Row click on the teacher dashboard's students table/cards opens this
// (Task D2): tabs "Books" and "Check-ins" over one student. Rather than a
// third modal wrapping both, the tab switch swaps which of the two
// existing full-dialog components is mounted — Books literally reuses
// StudentBooks (per the brief), Check-ins is its new sibling — and each
// renders this same small switcher via its `headerExtra` prop, so visually
// it reads as one dialog with two tabs even though only one is ever
// mounted at a time.
function Tabs({ active, onChange }) {
  const { t } = useTranslation()
  const tab = (id, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={active === id}
      onClick={() => onChange(id)}
      className={`px-3 py-1.5 rounded-full font-body text-xs font-semibold transition-colors ${
        active === id ? 'bg-white/[0.14] text-galaxy-text' : 'text-galaxy-text-muted hover:text-galaxy-text'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div role="tablist" className="flex items-center gap-1 rounded-full bg-white/5 p-1 shrink-0">
      {tab('books', t('school:teacher.dashboard.drawer.tab_books'))}
      {tab('checkins', t('school:teacher.dashboard.drawer.tab_checkins'))}
    </div>
  )
}

export default function StudentDetailDrawer({ classId, student, onClose }) {
  const [tab, setTab] = useState('books')
  const tabs = <Tabs active={tab} onChange={setTab} />

  return tab === 'books' ? (
    <StudentBooks classId={classId} student={student} onClose={onClose} headerExtra={tabs} />
  ) : (
    <StudentCheckIns classId={classId} student={student} onClose={onClose} headerExtra={tabs} />
  )
}
