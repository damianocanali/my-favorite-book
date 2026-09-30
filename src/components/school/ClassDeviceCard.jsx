// "Set up this browser for this class" on the teacher's class page. When set
// (src/lib/classDevice.js), this browser opens on the class's name list for
// anyone signed out, so children never type the code. Teacher-only by
// construction: it lives on TeacherClassPage, behind ProtectedRoute and the
// server's ownership check on the class it lists.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor } from 'lucide-react'
import { readClassDevice, writeClassDevice, clearClassDevice } from '../../lib/classDevice'

export default function ClassDeviceCard({ classId, name, code }) {
  const { t } = useTranslation()
  const [device, setDevice] = useState(() => readClassDevice())
  // 'setup' | 'remove' | null — an inline confirm, never a modal.
  const [confirming, setConfirming] = useState(null)

  // The teacher made a new code for this class: keep this browser working.
  useEffect(() => {
    if (device && device.classId === classId && code && device.code !== code) {
      if (writeClassDevice({ classId, code, name })) setDevice(readClassDevice())
    }
  }, [device, classId, code, name])

  const isThisClass = device?.classId === classId

  function handleSetUp() {
    if (writeClassDevice({ classId, code, name })) setDevice(readClassDevice())
    setConfirming(null)
  }

  function handleRemove() {
    clearClassDevice()
    setDevice(null)
    setConfirming(null)
  }

  return (
    <div className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-3">
      {device && (
        <p className="flex items-center gap-2 font-body text-galaxy-text">
          <Monitor size={18} className="text-galaxy-secondary shrink-0" aria-hidden="true" />
          {t('school:teacher.class_device.status', { name: device.name })}
        </p>
      )}

      {confirming === 'setup' && (
        <div className="space-y-2 rounded-xl bg-white/[0.04] p-4">
          <p className="font-heading font-bold text-galaxy-text">{t('school:teacher.class_device.confirm_title', { name })}</p>
          <p className="font-body text-sm text-galaxy-text-muted">{t('school:teacher.class_device.confirm_body', { name })}</p>
          {device && !isThisClass && (
            <p className="font-body text-sm font-semibold text-yellow-300">
              {t('school:teacher.class_device.confirm_replaces', { name: device.name })}
            </p>
          )}
          <p className="font-body text-sm text-galaxy-text-muted">{t('school:teacher.class_device.confirm_note')}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleSetUp}
              className="min-h-[44px] px-4 rounded-xl font-body font-bold text-white btn-fill-primary"
            >
              {t('school:teacher.class_device.confirm_action')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="min-h-[44px] px-4 rounded-xl font-body text-galaxy-text-muted border border-galaxy-text-muted/20 hover:text-galaxy-text"
            >
              {t('school:teacher.class_device.cancel')}
            </button>
          </div>
        </div>
      )}

      {confirming === 'remove' && (
        <div className="space-y-2 rounded-xl bg-white/[0.04] p-4">
          <p className="font-heading font-bold text-galaxy-text">{t('school:teacher.class_device.remove_title', { name: device?.name ?? name })}</p>
          <p className="font-body text-sm text-galaxy-text-muted">{t('school:teacher.class_device.remove_body')}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleRemove}
              className="min-h-[44px] px-4 rounded-xl font-body font-bold text-white bg-red-500/80 hover:bg-red-500"
            >
              {t('school:teacher.class_device.remove')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="min-h-[44px] px-4 rounded-xl font-body text-galaxy-text-muted border border-galaxy-text-muted/20 hover:text-galaxy-text"
            >
              {t('school:teacher.class_device.cancel')}
            </button>
          </div>
        </div>
      )}

      {confirming === null && (
        isThisClass ? (
          <button
            type="button"
            onClick={() => setConfirming('remove')}
            className="min-h-[44px] text-sm font-body font-semibold text-red-300 hover:text-red-200"
          >
            {t('school:teacher.class_device.remove')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming('setup')}
            disabled={!code}
            className="min-h-[48px] w-full sm:w-auto px-4 rounded-xl font-body font-bold text-white btn-fill-primary disabled:opacity-50"
          >
            {t('school:teacher.class_device.setup')}
          </button>
        )
      )}
    </div>
  )
}
