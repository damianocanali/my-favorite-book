import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Volume2, VolumeX } from 'lucide-react'
import NameTiles from '../components/school/NameTiles'
import PicturePad from '../components/school/PicturePad'
import Mascot from '../components/ui/Mascot'
import { fetchRoster, signInWithPictures } from '../lib/schoolApi'
import { useAuthStore } from '../stores/useAuthStore'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import { readClassDevice, isClassUnavailable } from '../lib/classDevice'

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
  const [searchParams] = useSearchParams()
  // A class browser opens straight on its class's name list; the child
  // never types the code. ?other=1 (the chooser's "I'm a student" on a
  // class browser) asks for the ordinary code step instead. Without a
  // class browser nothing is remembered: the code step every time.
  const [device] = useState(() => (searchParams.get('other') === '1' ? null : readClassDevice()))
  const [deviceError, setDeviceError] = useState(null)
  const [loadingDevice, setLoadingDevice] = useState(!!device)

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

  async function attemptCode(value) {
    setCheckingCode(true)
    setErrorCode(null)
    const res = await fetchRoster(value)
    setCheckingCode(false)
    if (res.ok) {
      setClassroom(res.data.classroom)
      setStudents(res.data.students ?? [])
      setStep('name')
      return
    }
    setErrorCode(res.code)
  }

  // Class browser: load its class. If the stored code stops working (class
  // archived, code changed, sign-in closed) say so kindly and stay put —
  // only a teacher removes the class from this browser.
  async function loadDevice() {
    if (!device) return
    setLoadingDevice(true)
    setDeviceError(null)
    setErrorCode(null)
    setCode(device.code)
    const res = await fetchRoster(device.code)
    setLoadingDevice(false)
    if (res.ok) {
      setClassroom(res.data.classroom)
      setStudents(res.data.students ?? [])
      setSelectedStudent(null)
      setPicks([])
      setStep('name')
      return
    }
    setDeviceError(res.code || 'generic')
    setStep('code')
  }

  useEffect(() => {
    loadDevice()
    // Mount-only.
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
    setCode('')
    setClassroom(null)
    setStudents([])
    setErrorCode(null)
    setStep('code')
  }

  function handleBackOne() {
    if (submitting || shake) return
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
    navigate('/bookshelf', { replace: true })
  }

  function handlePick(id) {
    if (submitting || isBlockingPictureError || shake) return
    const next = [...picks, id]
    setPicks(next)
    if (next.length === 3) submitPictures(next)
  }

  // 'wrong_pictures' is retry-in-place (shake, clear, try again); every
  // other sign-in error means this attempt is a dead end until something
  // outside the child's control changes — show "Start over" instead of a
  // pad that will just fail again.
  const isBlockingPictureError = step === 'pictures' && !!errorCode && errorCode !== 'wrong_pictures'

  const deviceMessage = deviceError
    ? (isClassUnavailable(deviceError)
        ? t('school:class_device.unavailable')
        : t(`school:errors.${errorMessageKey(deviceError)}`))
    : null

  const speechText = useMemo(() => {
    const parts = []
    if (step === 'code' && device) parts.push(deviceError ? deviceMessage : t('school:code_step.checking'))
    else if (step === 'code') parts.push(t('school:code_step.heading'), t('school:code_step.hint'))
    else if (step === 'name') parts.push(t('school:name_step.heading'))
    else if (step === 'pictures') parts.push(t('school:picture_step.heading'))
    if (errorCode) parts.push(t(`school:errors.${errorMessageKey(errorCode)}`))
    return parts.join('. ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, errorCode, deviceError, deviceMessage, t])

  function handleListen() {
    if (isSpeaking) stopSpeaking()
    else speak(speechText)
  }

  // ?choose=1: on a class browser /login would otherwise send them
  // straight back here.
  function handleGrownUpSignIn() {
    navigate('/login?choose=1')
  }

  // After a dead-end sign-in error: a typed-code child starts again from
  // the code; a class browser reloads its own class.
  function handleStartOver() {
    if (device) loadDevice()
    else handleNotMyClass()
  }

  const wide = step !== 'code'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 md:py-3">
      <motion.div
        className={`w-full ${wide ? 'max-w-lg md:max-w-xl' : 'max-w-md'}`}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className={`text-center ${wide ? 'mb-3 md:mb-1' : 'mb-6'}`}>
          {device && (
            // Which class this browser belongs to, before anything else. A
            // class name is data, never translated.
            <p className="inline-block mb-3 px-5 py-2 rounded-full bg-gradient-to-r from-galaxy-primary to-galaxy-secondary font-heading text-xl font-extrabold text-white">
              {t('school:class_device.banner', { name: device.name })}
            </p>
          )}
          {/* A big, friendly hello above every step — the same mascot the
              rest of the app uses for celebrations, here just waving
              hello, so a pre-reading child recognises this page as
              welcoming before they've read a single word of it. Wrapped in
              a flex container (rather than relying on Mascot's own
              mx-auto) because Mascot's root is a block box sized by
              height with width:auto, which stretches to fill a block
              parent instead of shrinking to the art's intrinsic width —
              flex centering sidesteps that regardless of the art's shape.
              Hidden at md+ on the name/pictures steps only: those two
              already changed pictures/tiles to fill more of an iPad
              screen (see NameTiles/PicturePad), and there wasn't room left
              for a hello too without the picture step needing to scroll. */}
          <div className={`flex justify-center mb-3 ${wide ? 'md:hidden' : ''}`}>
            <Mascot mood="wave" size={96} />
          </div>
          <h1 className={`font-heading text-2xl font-bold text-galaxy-text ${wide ? 'md:text-xl' : ''}`}>{t('school:page_title')}</h1>
          {!device && (
            <button
              type="button"
              onClick={handleGrownUpSignIn}
              className="mt-1.5 text-xs font-body text-galaxy-text-muted/70 underline underline-offset-2 hover:text-galaxy-text-muted transition-colors"
            >
              {t('school:grown_up_link')}
            </button>
          )}
        </div>

        <div className="glass rounded-2xl p-6 md:p-3 border border-galaxy-text-muted/10 space-y-5 md:space-y-2">
          {!device && classroom?.name && step !== 'code' && (
            <p className="text-galaxy-secondary font-body text-xs font-semibold uppercase tracking-wide -mb-2 md:-mb-3">
              {classroom.name}
            </p>
          )}
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-lg font-bold text-galaxy-text">
              {step === 'code' && device && (deviceError ? t('school:class_device.heading') : t('school:code_step.checking'))}
              {step === 'code' && !device && t('school:code_step.heading')}
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

          {step === 'code' && !device && (
            <p className="text-galaxy-text-muted font-body text-sm -mt-3">{t('school:code_step.hint')}</p>
          )}

          {step === 'code' && device && (
            <div className="space-y-3" aria-live="polite">
              {loadingDevice || !deviceError ? (
                <div className="flex justify-center py-6">
                  <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <p role="alert" className="text-galaxy-text font-body text-lg text-center bg-white/[0.06] rounded-xl px-4 py-4">
                    {deviceMessage}
                  </p>
                  <button
                    type="button"
                    onClick={loadDevice}
                    className="min-h-[52px] w-full rounded-full font-body font-bold text-white btn-fill-primary"
                  >
                    {t('school:class_device.try_again')}
                  </button>
                </>
              )}
            </div>
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

          {step === 'code' && !device && (
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
                className="w-full min-h-[72px] text-center text-4xl tracking-[0.4em] font-mono font-bold py-4 glass border border-white/15 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/30 focus:border-galaxy-primary focus:outline-none uppercase"
              />
              {checkingCode && (
                <p className="text-galaxy-text-muted font-body text-sm text-center">
                  {t('school:code_step.checking')}
                </p>
              )}
            </div>
          )}

          {step === 'name' && (
            <div className="space-y-4 md:space-y-2">
              <NameTiles students={students} onSelect={handleSelectStudent} />
              {/* On a class browser "Not in <class>?" (below) is the way out. */}
              {!device && (
                <button
                  type="button"
                  onClick={handleNotMyClass}
                  className="min-h-[48px] md:min-h-[40px] w-full flex items-center justify-center text-center text-galaxy-text-muted text-sm font-body hover:text-galaxy-primary transition-colors"
                >
                  {t('school:name_step.not_my_class')}
                </button>
              )}
            </div>
          )}

          {step === 'pictures' && (
            <div className="space-y-4 md:space-y-2">
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
                  onClick={handleStartOver}
                  className="min-h-[48px] w-full flex items-center justify-center text-center text-galaxy-text-muted text-sm font-body hover:text-galaxy-primary transition-colors"
                >
                  {t('school:picture_step.start_over')}
                </button>
              )}
            </div>
          )}
        </div>

        {device && (
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={handleGrownUpSignIn}
              className="min-h-[48px] px-4 text-base font-body text-galaxy-text-muted underline underline-offset-2 hover:text-galaxy-text transition-colors"
            >
              {t('school:class_device.not_in', { name: device.name })}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
