// The teacher creates a student's avatar from the class roster — never a
// photo (students can no longer open /avatar at all). Same feature picker
// as src/pages/AvatarPage.jsx (catalogs shared via
// ../avatar/avatarCatalog.js), posting to api/school/student-avatar.js
// instead of api/generate-avatar.js. Same modal treatment as StudentBooks:
// portal, role="dialog" + aria-modal, focus moved onto the panel and given
// back on close, Escape alongside the Close button.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { X, Wand2, Loader2 } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { teacherErrorText } from './teacherErrors'
import {
  SKIN_TONES, HAIR_STYLES, HAIR_COLORS, CLOTHING_OPTIONS,
  HAT_OPTIONS, ACCESSORY_OPTIONS, EXPRESSION_OPTIONS, ART_STYLES,
} from '../avatar/avatarCatalog'

const DEFAULT_FEATURES = {
  skinTone: 'medium',
  hairStyle: 'short',
  hairColor: 'brown',
  clothing: 'blue t-shirt',
  hat: 'none',
  accessory: 'none',
  expression: 'happy smiling',
}

function OptionRow({ label, options, value, onChange, colorKey }) {
  return (
    <div className="space-y-1.5">
      <p className="text-galaxy-text-muted text-xs font-body font-semibold">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body transition-all ${
              value === opt.id
                ? 'bg-galaxy-primary text-white font-bold'
                : 'glass border border-galaxy-text-muted/20 text-galaxy-text-muted hover:text-galaxy-text hover:border-galaxy-primary/40'
            }`}
          >
            {colorKey && opt[colorKey] && (
              <span
                className="w-3 h-3 rounded-full border border-white/30 shrink-0"
                style={{ backgroundColor: opt[colorKey] }}
              />
            )}
            {opt.labelKey}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function StudentAvatarEditor({ classId, student, onClose, onSaved }) {
  const { t } = useTranslation()
  const panelRef = useRef(null)

  const [features, setFeatures] = useState(DEFAULT_FEATURES)
  const [artStyle, setArtStyle] = useState('cartoon')
  const [avatarUrl, setAvatarUrl] = useState(student.avatar_url ?? null)
  const [imgFailed, setImgFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  // Set on a 200 response whose avatar_url is a data: URI (Storage upload
  // failed) — the preview above still shows it, but nothing was persisted,
  // so the roster thumbnail and next load won't have it either.
  const [notSaved, setNotSaved] = useState(false)

  function setFeature(key, value) {
    setFeatures((f) => ({ ...f, [key]: value }))
  }

  async function load() {
    setLoading(true)
    setLoadError(null)
    const res = await schoolFetch(
      `/api/school/student-avatar?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(student.id)}`
    )
    setLoading(false)
    if (res.ok) {
      setAvatarUrl(res.data?.avatar_url ?? null)
      setImgFailed(false)
    } else {
      setLoadError(res.code || 'generic')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, student.id])

  useEffect(() => {
    const previouslyFocused = document.activeElement
    panelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate() {
    setSaving(true)
    setSaveError(null)
    setNotSaved(false)
    const res = await schoolFetch('/api/school/student-avatar', {
      method: 'POST',
      body: JSON.stringify({ classId, studentId: student.id, features, artStyle }),
    })
    setSaving(false)
    if (res.ok) {
      setAvatarUrl(res.data?.avatar_url ?? null)
      setImgFailed(false)
      if (res.data?.saved === false) {
        // Generated, but not persisted (Storage was unreachable) — the
        // roster thumbnail must not be told about a URL that only exists
        // as this response's data: URI, so onSaved is skipped.
        setNotSaved(true)
      } else {
        onSaved?.(student.id, res.data?.avatar_url ?? null)
      }
    } else {
      setSaveError(res.code || 'generic')
    }
  }

  const heading = t('school:teacher.avatar_editor.heading', { name: student.display_name })

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-text-muted/10 focus:outline-none"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-heading text-lg font-bold text-galaxy-text truncate">{heading}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common:actions.close')}
            className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 mb-5">
          <div className="relative w-32 h-32 rounded-full overflow-hidden shrink-0 glass border-2 border-galaxy-text-muted/20 flex items-center justify-center">
            {avatarUrl && !imgFailed ? (
              <img
                src={avatarUrl}
                alt={t('school:teacher.avatar_editor.current_alt', { name: student.display_name })}
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span
                role="img"
                aria-label={t('school:teacher.avatar_editor.placeholder_alt')}
                className="text-5xl"
              >
                {student.avatar_emoji}
              </span>
            )}
            {(loading || saving) && (
              <div className="absolute inset-0 bg-galaxy-bg/80 flex items-center justify-center">
                <Loader2 size={28} className="text-galaxy-primary animate-spin" />
              </div>
            )}
          </div>

          {loadError && (
            <p className="text-red-400 text-sm font-body text-center">{teacherErrorText(t, loadError)}</p>
          )}

          {notSaved && (
            <p className="text-red-400 text-sm font-body text-center">{t('school:teacher.avatar_editor.not_saved')}</p>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={saving || loading}
            className="w-full max-w-[240px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-body font-bold text-sm text-white btn-fill-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> {t('school:teacher.avatar_editor.creating')}</>
            ) : (
              <><Wand2 size={16} /> {t('school:teacher.avatar_editor.create_cta')}</>
            )}
          </button>

          {saveError && (
            <p className="text-red-400 text-sm font-body text-center">{teacherErrorText(t, saveError)}</p>
          )}
        </div>

        <div className="glass rounded-2xl p-4 border border-galaxy-text-muted/10 mb-4">
          <p className="text-galaxy-text font-body text-sm font-bold mb-3">{t('account:avatar.art_style.title')}</p>
          <div className="flex flex-wrap gap-2">
            {ART_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => setArtStyle(style.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-body transition-all ${
                  artStyle === style.id
                    ? 'bg-galaxy-primary text-white font-bold'
                    : 'glass border border-white/15 text-galaxy-text hover:border-galaxy-primary/50'
                }`}
              >
                <span>{style.emoji}</span>
                {t(style.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-4 border border-galaxy-text-muted/10 space-y-4">
          <OptionRow
            label={t('account:avatar.features.skin_tone')}
            options={SKIN_TONES.map((o) => ({ ...o, labelKey: t(o.labelKey) }))}
            value={features.skinTone}
            onChange={(v) => setFeature('skinTone', v)}
            colorKey="color"
          />
          <OptionRow
            label={t('account:avatar.features.hair_style')}
            options={HAIR_STYLES.map((o) => ({ ...o, labelKey: t(o.labelKey) }))}
            value={features.hairStyle}
            onChange={(v) => setFeature('hairStyle', v)}
          />
          {features.hairStyle !== 'none' && (
            <OptionRow
              label={t('account:avatar.features.hair_color')}
              options={HAIR_COLORS.map((o) => ({ ...o, labelKey: t(o.labelKey) }))}
              value={features.hairColor}
              onChange={(v) => setFeature('hairColor', v)}
              colorKey="color"
            />
          )}
          <OptionRow
            label={t('account:avatar.features.clothing')}
            options={CLOTHING_OPTIONS.map((o) => ({ ...o, labelKey: t(o.labelKey) }))}
            value={features.clothing}
            onChange={(v) => setFeature('clothing', v)}
          />
          <OptionRow
            label={t('account:avatar.features.hat')}
            options={HAT_OPTIONS.map((o) => ({ ...o, labelKey: t(o.labelKey) }))}
            value={features.hat}
            onChange={(v) => setFeature('hat', v)}
          />
          <OptionRow
            label={t('account:avatar.features.accessory')}
            options={ACCESSORY_OPTIONS.map((o) => ({ ...o, labelKey: t(o.labelKey) }))}
            value={features.accessory}
            onChange={(v) => setFeature('accessory', v)}
          />
          <OptionRow
            label={t('account:avatar.features.expression')}
            options={EXPRESSION_OPTIONS.map((o) => ({ ...o, labelKey: t(o.labelKey) }))}
            value={features.expression}
            onChange={(v) => setFeature('expression', v)}
          />
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}
