import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useBookStore } from '../../stores/useBookStore'
import ProgressBar from '../layout/ProgressBar'
import StepTitle from './StepTitle'
import StepAuthor from './StepAuthor'
import StepColors from './StepColors'
import StepCharacters from './StepCharacters'
import StepSetting from './StepSetting'
import StepTimePeriod from './StepTimePeriod'
import StepReview from './StepReview'

const steps = [
  StepTitle,
  StepAuthor,
  StepColors,
  StepCharacters,
  StepSetting,
  StepTimePeriod,
  StepReview,
]

const variants = {
  enter: (direction) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
    scale: 0.95,
  }),
}

export default function WizardContainer({ onFinish }) {
  const currentStep = useBookStore((state) => state.currentStep)
  const nextStep = useBookStore((state) => state.nextStep)
  const prevStep = useBookStore((state) => state.prevStep)
  const directionRef = useRef(1)
  const [direction, setDirection] = useState(1)

  const handleNext = () => {
    directionRef.current = 1
    setDirection(1)
    nextStep()
  }

  const handlePrev = () => {
    directionRef.current = -1
    setDirection(-1)
    prevStep()
  }

  const handleGoToStep = (step) => {
    const dir = step < currentStep ? -1 : 1
    directionRef.current = dir
    setDirection(dir)
    useBookStore.getState().setStep(step)
  }

  // Scroll to top when step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep])

  const StepComponent = steps[currentStep]

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <ProgressBar currentStep={currentStep} />

      <div className="relative min-h-[400px] sm:min-h-[500px] mt-6 overflow-hidden">
        <AnimatePresence mode="wait" custom={directionRef.current}>
          <motion.div
            key={currentStep}
            custom={directionRef.current}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <StepComponent
              onNext={handleNext}
              onPrev={handlePrev}
              onFinish={onFinish}
              isFirst={currentStep === 0}
              isLast={currentStep === steps.length - 1}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
