// Printable picture sign-in cards for a batch of students whose pictures
// were just (re)generated. This is the ONLY place these three picture ids
// per student are ever visible after creation — the server never returns
// them again — so this component takes them straight from the create/reset
// response as a prop and the page that renders it is responsible for
// discarding that state on unmount. Nothing here writes to storage.
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import { chunk } from './rosterText'
import { enterCardsPrintMode, exitCardsPrintMode } from './printMode'
import { PICTURES } from '../../../lib/school/pictures.js'

const CARDS_PER_PAGE = 6
const emojiFor = (id) => PICTURES.find((p) => p.id === id)?.emoji ?? '❓'

function Card({ student, classInfo, footer }) {
  return (
    <div className="signin-card border border-galaxy-text-muted/20 rounded-2xl p-4 flex flex-col items-center text-center gap-2 bg-white text-black">
      <p className="text-xs font-body font-semibold uppercase tracking-wide opacity-70">{classInfo.name}</p>
      <p className="font-mono text-sm font-bold tracking-widest opacity-80">{classInfo.code}</p>
      <div className="text-4xl leading-none" aria-hidden="true">{student.avatar_emoji}</div>
      <p className="font-heading font-bold text-lg">{student.display_name}</p>
      <div className="flex items-center gap-3 mt-1">
        {student.pictures.map((id, i) => (
          <div key={id} className="flex flex-col items-center gap-0.5">
            <span className="text-3xl" aria-hidden="true">{emojiFor(id)}</span>
            <span className="text-xs font-body opacity-60">{i + 1}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-body opacity-50 mt-2">{footer}</p>
    </div>
  )
}

export default function SignInCards({ classInfo, students, onDismiss }) {
  const { t } = useTranslation()

  // Print mode is scoped to <html> for exactly as long as printing needs
  // it: entered right before window.print(), exited on `afterprint`, and
  // exited again on unmount as a second line of defense (e.g. the teacher
  // navigates away mid-dialog). Never left on if this component goes away.
  useEffect(() => {
    function handleAfterPrint() {
      exitCardsPrintMode(document)
    }
    window.addEventListener('afterprint', handleAfterPrint)
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      exitCardsPrintMode(document)
    }
  }, [])

  if (!students || students.length === 0) return null

  const pages = chunk(students, CARDS_PER_PAGE)
  const footer = t('school:teacher.cards.footer')

  function handlePrint() {
    enterCardsPrintMode(document)
    window.print()
  }

  return (
    <div className="glass rounded-2xl p-6 border border-galaxy-secondary/30 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading text-lg font-bold text-galaxy-text">{t('school:teacher.cards.heading')}</h2>
          <p className="text-amber-300 text-sm font-body mt-1 max-w-md">{t('school:teacher.cards.safety_note')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-body font-bold text-white btn-fill-primary transition-colors"
          >
            <Printer size={16} /> {t('school:teacher.cards.print')}
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-2.5 rounded-xl font-body text-sm text-galaxy-text-muted hover:text-galaxy-text transition-colors"
            >
              {t('common:actions.close')}
            </button>
          )}
        </div>
      </div>

      <div className="signin-cards">
        {pages.map((pageStudents, pageIdx) => (
          <div key={pageIdx} className="cards-page grid grid-cols-2 sm:grid-cols-3 gap-4">
            {pageStudents.map((s) => (
              <Card key={s.id} student={s} classInfo={classInfo} footer={footer} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
