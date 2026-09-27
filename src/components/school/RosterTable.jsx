// The class roster: one row per student, a status chip when something
// needs the teacher's attention, and a row menu for the five/six actions
// api/school/students.js's PATCH supports. All the actual network calls
// happen through the `onAction` prop (owned by TeacherClassPage) — this
// component only renders and confirms.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreVertical, Lock, HelpCircle, Trash2 } from 'lucide-react'
import { AVATAR_EMOJI } from '../../../lib/school/pictures.js'

function relativeTime(iso, locale) {
  if (!iso) return null
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const divisions = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Infinity, unit: 'year' },
  ]
  let duration = diffSec
  for (const { amount, unit } of divisions) {
    if (Math.abs(duration) < amount) return rtf.format(Math.round(duration), unit)
    duration /= amount
  }
  return null
}

function errorText(t, code) {
  return t(`school:teacher.errors.${code}`, { defaultValue: t('school:teacher.errors.generic') })
}

function RenameDialog({ student, onCancel, onConfirm }) {
  const { t } = useTranslation()
  const [name, setName] = useState(student.display_name)
  const [emoji, setEmoji] = useState(student.avatar_emoji)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await onConfirm({ name: name.trim(), emoji })
    setSaving(false)
    if (!res?.ok) setError(res?.code || 'generic')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-4">
        <h3 className="font-heading text-lg font-bold text-galaxy-text">{t('school:teacher.roster.rename_dialog.heading')}</h3>
        <div className="space-y-1">
          <label className="text-galaxy-text-muted text-sm font-body font-semibold">
            {t('school:teacher.roster.rename_dialog.name_label')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            className="w-full px-3 py-2.5 glass border border-white/15 rounded-xl text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body"
          />
        </div>
        <div className="space-y-1">
          <label className="text-galaxy-text-muted text-sm font-body font-semibold">
            {t('school:teacher.roster.rename_dialog.emoji_label')}
          </label>
          <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto p-1 glass rounded-xl border border-white/10">
            {AVATAR_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-pressed={emoji === e}
                className={`text-xl rounded-lg p-1 transition-colors ${
                  emoji === e ? 'bg-galaxy-secondary/30 ring-2 ring-galaxy-secondary' : 'hover:bg-white/[0.08]'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-red-400 text-sm font-body">{errorText(t, error)}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl font-body text-sm text-galaxy-text-muted hover:text-galaxy-text transition-colors"
          >
            {t('common:actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? t('common:state.saving') : t('common:actions.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function RowMenu({ student, open, onToggle, onAction }) {
  const { t } = useTranslation()
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={t('school:teacher.roster.menu.open_aria', { name: student.display_name })}
        className="p-2 rounded-lg text-galaxy-text-muted hover:text-galaxy-text hover:bg-white/[0.06] transition-colors"
      >
        <MoreVertical size={18} />
      </button>
    )
  }

  const item = (label, action, extra) => (
    <button
      type="button"
      onClick={() => onAction(action, extra)}
      className="w-full text-left px-3 py-2 text-sm font-body text-galaxy-text hover:bg-white/[0.08] rounded-lg transition-colors"
    >
      {label}
    </button>
  )

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-label={t('school:teacher.roster.menu.open_aria', { name: student.display_name })}
        className="p-2 rounded-lg text-galaxy-text-muted hover:text-galaxy-text hover:bg-white/[0.06] transition-colors"
      >
        <MoreVertical size={18} />
      </button>
      <div className="absolute right-0 top-full mt-1 z-10 w-48 glass rounded-xl border border-galaxy-text-muted/15 p-1.5 shadow-xl">
        {student.status === 'active' ? (
          <>
            {item(t('school:teacher.roster.menu.new_pictures'), 'reset_secret')}
            {(student.locked || student.hard_locked) && item(t('school:teacher.roster.menu.unlock'), 'unlock')}
            {item(t('school:teacher.roster.menu.rename'), 'rename')}
            {item(t('school:teacher.roster.menu.sign_out'), 'sign_out')}
            {item(t('school:teacher.roster.menu.remove'), 'remove')}
          </>
        ) : (
          item(t('school:teacher.roster.menu.restore'), 'restore')
        )}
      </div>
    </div>
  )
}

export default function RosterTable({ students, onAction }) {
  const { t, i18n } = useTranslation()
  const [openMenu, setOpenMenu] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const [rowError, setRowError] = useState(null)

  async function runAction(student, action, extra) {
    setOpenMenu(null)
    if (action === 'rename') {
      setRenaming(student)
      return
    }
    if (action === 'remove') {
      if (!window.confirm(t('school:teacher.roster.remove_confirm', { name: student.display_name }))) return
    }
    setRowError(null)
    const res = await onAction(student.id, action, extra)
    if (!res?.ok) setRowError({ id: student.id, code: res?.code || 'generic' })
  }

  if (students.length === 0) {
    return <p className="text-galaxy-text-muted font-body text-sm text-center py-8">{t('school:teacher.roster.empty')}</p>
  }

  return (
    <div className="space-y-2">
      {students.map((s) => {
        const removed = s.status === 'removed'
        return (
          <div
            key={s.id}
            className={`glass rounded-xl p-3 border border-galaxy-text-muted/10 flex items-center gap-3 ${removed ? 'opacity-60' : ''}`}
          >
            <span className="text-2xl shrink-0" aria-hidden="true">{s.avatar_emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-body font-semibold text-galaxy-text truncate">{s.display_name}</p>
              <p className="text-galaxy-text-muted text-xs font-body">
                {s.last_sign_in_at
                  ? t('school:teacher.roster.last_sign_in', { when: relativeTime(s.last_sign_in_at, i18n.language) })
                  : t('school:teacher.roster.last_sign_in_never')}
              </p>
              {rowError?.id === s.id && (
                <p className="text-red-400 text-xs font-body mt-0.5">{errorText(t, rowError.code)}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {removed && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-body font-semibold border bg-galaxy-text-muted/10 text-galaxy-text-muted border-galaxy-text-muted/20">
                  <Trash2 size={12} /> {t('school:teacher.roster.status.removed')}
                </span>
              )}
              {!removed && s.hard_locked && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-body font-semibold border bg-amber-500/15 text-amber-300 border-amber-500/30">
                  <HelpCircle size={12} /> {t('school:teacher.roster.status.needs_teacher')}
                </span>
              )}
              {!removed && !s.hard_locked && s.locked && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-body font-semibold border bg-amber-500/15 text-amber-300 border-amber-500/30">
                  <Lock size={12} /> {t('school:teacher.roster.status.locked')}
                </span>
              )}
              <RowMenu
                student={s}
                open={openMenu === s.id}
                onToggle={() => setOpenMenu((cur) => (cur === s.id ? null : s.id))}
                onAction={(action, extra) => runAction(s, action, extra)}
              />
            </div>
          </div>
        )
      })}

      {renaming && (
        <RenameDialog
          student={renaming}
          onCancel={() => setRenaming(null)}
          onConfirm={async (extra) => {
            const res = await onAction(renaming.id, 'rename', extra)
            if (res?.ok) setRenaming(null)
            return res
          }}
        />
      )}
    </div>
  )
}
