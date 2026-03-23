import { motion } from 'motion/react'
import { Star } from 'lucide-react'

const STEPS = [
  'Title',
  'Author',
  'Colors',
  'Characters',
  'Setting',
  'Time',
  'Review',
]

export default function ProgressBar({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 py-4 px-2">
      {STEPS.map((label, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        const isUpcoming = index > currentStep

        return (
          <div key={label} className="flex items-center">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <motion.div
                className={`relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all ${
                  isCompleted
                    ? 'bg-galaxy-primary text-white'
                    : isCurrent
                    ? 'bg-galaxy-primary/20 border-2 border-galaxy-primary text-galaxy-primary'
                    : 'bg-galaxy-bg-light text-galaxy-text-muted border border-galaxy-text-muted/20'
                }`}
                animate={
                  isCurrent
                    ? { boxShadow: ['0 0 0px rgba(139,92,246,0.3)', '0 0 20px rgba(139,92,246,0.5)', '0 0 0px rgba(139,92,246,0.3)'] }
                    : {}
                }
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isCompleted ? (
                  <Star size={16} fill="currentColor" />
                ) : (
                  <span className="text-xs font-bold font-body">{index + 1}</span>
                )}
              </motion.div>
              <span
                className={`text-[10px] sm:text-xs mt-1 font-body font-semibold ${
                  isCurrent ? 'text-galaxy-primary' : isCompleted ? 'text-galaxy-text' : 'text-galaxy-text-muted'
                }`}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div
                className={`w-4 sm:w-8 h-0.5 mx-0.5 sm:mx-1 mt-[-16px] sm:mt-[-18px] ${
                  isCompleted ? 'bg-galaxy-primary' : 'bg-galaxy-text-muted/20'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
