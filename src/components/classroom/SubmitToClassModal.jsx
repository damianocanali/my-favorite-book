import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { motion } from 'motion/react'
import { Send, CheckCircle } from 'lucide-react'
import SparkleButton from '../ui/SparkleButton'
import { useRewardsStore } from '../../stores/useRewardsStore'
import { apiFetch } from '../../lib/api'
import { celebrateBig } from '../../lib/celebrate'

export default function SubmitToClassModal({ book, onClose }) {
  const { t } = useTranslation()
  const earnBadge = useRewardsStore((s) => s.earnBadge)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 4) { setError(t('gallery:submit_to_class.error_missing_code')); return }
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/api/classroom-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed, book }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('gallery:submit_to_class.submit_failed'))
      setSuccess(true)
      celebrateBig()
      earnBadge('submitted_class')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        className="relative rounded-modal p-6 max-w-sm w-full bg-gradient-to-br from-[#38246B] to-[#662E80] shadow-glow-modal"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {success ? (
          <div className="text-center py-4 space-y-3">
            <CheckCircle size={48} className="text-green-400 mx-auto" />
            <h2 className="font-heading text-xl font-bold text-galaxy-text">
              {t('gallery:submit_to_class.success_title')}
            </h2>
            <p className="text-galaxy-text-muted font-body text-sm">
              <Trans
                i18nKey="gallery:submit_to_class.success_body"
                values={{ title: book.title }}
                components={{ title: <span className="text-galaxy-text font-semibold" /> }}
              />
            </p>
            <SparkleButton onClick={onClose} size="small">{t('common:actions.done')}</SparkleButton>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-galaxy-secondary/20 flex items-center justify-center flex-shrink-0">
                <Send size={20} className="text-galaxy-secondary" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-galaxy-text">
                  {t('gallery:submit_to_class.title')}
                </h2>
                <p className="text-galaxy-text-muted text-xs font-body">
                  {t('gallery:submit_to_class.subtitle')}
                </p>
              </div>
            </div>

            <p className="text-galaxy-text-muted font-body text-sm">
              {t('gallery:submit_to_class.instruction')}
            </p>

            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder={t('gallery:submit_to_class.code_placeholder')}
              maxLength={8}
              className="w-full px-4 py-3 bg-galaxy-bg border border-galaxy-secondary/30 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/50 focus:border-galaxy-secondary focus:outline-none font-mono text-center text-xl tracking-widest uppercase"
            />

            {error && <p className="text-red-400 text-sm font-body">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-xl font-body font-semibold text-galaxy-text-muted border border-galaxy-text-muted/30 hover:border-galaxy-text-muted/60 transition-colors text-sm"
              >
                {t('common:actions.cancel')}
              </button>
              <SparkleButton
                onClick={handleSubmit}
                disabled={!code.trim() || loading}
                size="small"
                className="flex-1"
              >
                {loading ? t('gallery:submit_to_class.submitting') : t('gallery:submit_to_class.submit')}
              </SparkleButton>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
