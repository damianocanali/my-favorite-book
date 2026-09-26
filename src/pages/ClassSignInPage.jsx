import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { GraduationCap, Volume2, VolumeX } from 'lucide-react'
import NameTiles from '../components/school/NameTiles'
import PicturePad from '../components/school/PicturePad'
import {
  fetchRoster, signInWithPictures, rememberClassCode, recallClassCode, forgetClassCode,
} from '../lib/schoolApi'
import { useAuthStore } from '../stores/useAuthStore'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'

// Every code the server can hand back for roster/sign-in, mapped down to
// one of the seven child-facing messages in school.json's `errors`. Codes
// never shown to children directly — no price, no attempt counter, no "your
// school didn't pay", per the schools global constraints — only ever this
// small set of reassuring sentences.
const CLASS_UNAVAILABLE_CODES = new Set(['sign_in_closed', 'class_paused', 'class_resting'])

function errorMessageKey(code) {
  if (code === 'class_not_found') return 'class_not_found'
  if (CLASS_UNAVAILABLE_CODES.has(code)) return 'class_unavailable'
  if (code === 'too_many') return 'too_many'
  if (code === 'wrong_pictures') return 'wrong_pictures'
  if (code === 'locked') return 'locked'
  if (code === 'ask_teacher') return 'ask_teacher'
  // bad_request, student_not_found, sign_in_failed, upstream, not_configured,
  // method_not_allowed, and a network failure's undefined code all land
  // here — none of them are anything a child could act on.
  return 'generic'
}

// How long the wrong-guess shake plays before the slots clear. Purely a
// data-clearing delay, not an animation driver — the shake itself is a CSS
// `animate-shake` utility that the app-wide reduced-motion rule in
// index.css already collapses to ~0ms when the OS asks for less motion, so
// this timeout doesn't need its own reduced-motion branch.
const SHAKE_MS = 450

export default function ClassSignInPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signInAsStudent = useAuthStore((s) => s.signInAsStudent)

  const [step, setStep] = useState('code') // 'code' | 'name' | 'pictures'
  const [code, setCode] = useState('')
  const [classroom, setClassroom] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [picks, setPicks] = useState([])
  const [shake, setShake] = useState(false)
  const [errorCode, setErrorCode] = useState(null)
  const [checkingCode, setCheckingCode] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { speak, stop: stopSpeaking, isSpeaking, isSupported: ttsSupported } = useSpeechSynthesis()

  async function attemptCode(value, { silent = false } = {}) {
    setCheckingCode(true)
    setErrorCode(null)
    const res = await fetchRoster(value)
    setCheckingCode(false)
    if (res.ok) {
      setClassroom(res.data.classroom)
      setStudents(res.data.students ?? [])
      rememberClassCode(value)
      setStep('name')
      return
    }
    if (silent && res.code === 'class_not_found') {
      // The remembered code no longer points at a real class (rotated or
      // deleted) — quietly forget it rather than greeting a child who
      // never typed anything with an error banner.
      forgetClassCode()
      setCode('')
      return
    }
    setErrorCode(res.code)
  }

  // A remembered class loads silently; the code step below only ever
  // renders if that attempt didn't land on 'name'.
  useEffect(() => {
    const saved = recallClassCode()
    if (!saved) return
    setCode(saved)
    attemptCode(saved, { silent: true })
    // Deliberately mount-only: re-running this on every `code` change would
    // refetch on every keystroke instead of once at load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCodeChange(e) {
    const next = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setCode(next)
    if (errorCode) setErrorCode(null)
    if (next.length === 6) attemptCode(next)
  }

  function handleSelectStudent(student) {
    setSelectedStudent(student)
    setPicks([])
    setErrorCode(null)
    setStep('pictures')
  }

  function handleNotMyClass() {
    forgetClassCode()
    setCode('')
    setClassroom(null)
    setStudents([])
    setErrorCode(null)
    setStep('code')
  }

  function handleBackOne() {
    if (submitting) return
    setPicks((prev) => prev.slice(0, -1))
  }

  async function submitPictures(pictures) {
    setSubmitting(true)
    setErrorCode(null)
    const res = await signInWithPictures({ code, studentId: selectedStudent.id, pictures })
    if (!res.ok) {
      setSubmitting(false)
      if (res.code === 'wrong_pictures') {
        setShake(true)
        setErrorCode('wrong_pictures')
        // No attempt counter is ever shown to a child — this only clears
        // the slots so they can try again, it doesn't track how many times.
        setTimeout(() => { setShake(false); setPicks([]) }, SHAKE_MS)
      } else {
        setErrorCode(res.code)
        setPicks([])
      }
      return
    }
    try {
      await signInAsStudent(res.data)
    } catch {
      setSubmitting(false)
      setErrorCode('generic')
      setPicks([])
      return
    }
    rememberClassCode(code)
    navigate('/bookshelf', { replace: true })
  }

  function handlePick(id) {
    if (submitting || isBlockingPictureError) return
    const next = [...picks, id]
    setPicks(next)
    if (next.length === 3) submitPictures(next)
  }

  // 'wrong_pictures' is retry-in-place (shake, clear, try again); every
  // other sign-in error means this attempt is a dead end until something
  // outside the child's control changes — show "Start over" instead of a
  // pad that will just fail again.
  const isBlockingPictureError = step === 'pictures' && !!errorCode && errorCode !== 'wrong_pictures'

  const speechText = useMemo(() => {
    const parts = []
    if (step === 'code') parts.push(t('school:code_step.heading'), t('school:code_step.hint'))
    else if (step === 'name') parts.push(t('school:name_step.heading'))
    else if (step === 'pictures') parts.push(t('school:picture_step.heading'))
    if (errorCode) parts.push(t(`school:errors.${errorMessageKey(errorCode)}`))
    return parts.join('. ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, errorCode, t])

  function handleListen() {
    if (isSpeaking) stopSpeaking()
    else speak(speechText)
  }

  const wide = step !== 'code'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'}`}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-galaxy-secondary/20 flex items-center justify-center">
            <GraduationCap size={32} className="text-galaxy-secondary" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-galaxy-text">{t('school:page_title')}</h1>
        </div>

        <div className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-5">
          {classroom?.name && step !== 'code' && (
            <p className="text-galaxy-secondary font-body text-xs font-semibold uppercase tracking-wide -mb-2">
              {classroom.name}
            </p>
          )}
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-lg font-bold text-galaxy-text">
              {step === 'code' && t('school:code_step.heading')}
              {step === 'name' && t('school:name_step.heading')}
              {step === 'pictures' && t('school:picture_step.heading')}
            </h2>
            {ttsSupported && (
              <button
                type="button"
                onClick={handleListen}
                aria-label={isSpeaking ? t('school:actions.stop_listening') : t('school:actions.listen')}
                className="shrink-0 p-2.5 rounded-xl text-galaxy-secondary hover:bg-white/[0.08] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                {isSpeaking ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
              </button>
            )}
          </div>

          {step === 'code' && (
            <p className="text-galaxy-text-muted font-body text-sm -mt-3">{t('school:code_step.hint')}</p>
          )}

          <AnimatePresence>
            {errorCode && (
              <motion.p
                role="alert"
                aria-live="assertive"
                className="text-red-300 text-sm font-body bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {t(`school:errors.${errorMessageKey(errorCode)}`)}
              </motion.p>
            )}
          </AnimatePresence>

          {step === 'code' && (
            <div className="space-y-3">
              <input
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck="false"
                maxLength={6}
                value={code}
                onChange={handleCodeChange}
                disabled={checkingCode}
                aria-label={t('school:code_step.input_aria_label')}
                placeholder="ABC234"
                className="w-full text-center text-3xl tracking-[0.4em] font-mono font-bold py-5 glass border border-white/15 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/30 focus:border-galaxy-primary focus:outline-none uppercase"
              />
              {checkingCode && (
                <p className="text-galaxy-text-muted font-body text-sm text-center">
                  {t('school:code_step.checking')}
                </p>
              )}
            </div>
          )}

          {step === 'name' && (
            <div className="space-y-4">
              <NameTiles students={students} onSelect={handleSelectStudent} />
              <button
                type="button"
                onClick={handleNotMyClass}
                className="w-full text-center text-galaxy-text-muted text-sm font-body hover:text-galaxy-primary transition-colors"
              >
                {t('school:name_step.not_my_class')}
              </button>
            </div>
          )}

          {step === 'pictures' && (
            <div className="space-y-4">
              {!isBlockingPictureError && (
                <>
                  <PicturePad
                    picked={picks}
                    onPick={handlePick}
                    onBack={handleBackOne}
                    shake={shake}
                    disabled={submitting}
                  />
                  {submitting && (
                    <p className="text-galaxy-text-muted font-body text-sm text-center">
                      {t('school:picture_step.checking')}
                    </p>
                  )}
                </>
              )}
              {isBlockingPictureError && (
                <button
                  type="button"
                  onClick={handleNotMyClass}
                  className="w-full text-center text-galaxy-text-muted text-sm font-body hover:text-galaxy-primary transition-colors"
                >
                  {t('school:picture_step.start_over')}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
