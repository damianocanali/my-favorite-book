import { Volume2, VolumeX, Mic, MicOff, Type, Maximize2, Minimize2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAccessibilityStore } from '../../stores/useAccessibilityStore'

function ToolButton({ onClick, active, activeColor = 'galaxy-secondary', icon: Icon, activeIcon: ActiveIcon, label, disabled }) {
  const Icon_ = active && ActiveIcon ? ActiveIcon : Icon
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`
        flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs font-body font-semibold
        transition-all duration-150 select-none
        ${active
          ? `bg-${activeColor}/20 text-${activeColor} ring-1 ring-${activeColor}/50`
          : 'text-galaxy-text-muted hover:text-galaxy-text hover:bg-galaxy-bg'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <Icon_ size={18} />
      <span className="hidden sm:block leading-none">{label}</span>
    </button>
  )
}

export default function AccessibilityToolbar({ onReadAloud, onStopReading, onStartVoice, onStopVoice, isSpeaking, isListening, ttsSupported, voiceSupported }) {
  const { t } = useTranslation()
  const dyslexiaFont = useAccessibilityStore((s) => s.dyslexiaFont)
  const focusMode = useAccessibilityStore((s) => s.focusMode)
  const toggleDyslexiaFont = useAccessibilityStore((s) => s.toggleDyslexiaFont)
  const toggleFocusMode = useAccessibilityStore((s) => s.toggleFocusMode)

  return (
    <div className="flex items-center gap-1 p-2 bg-galaxy-bg rounded-xl border border-galaxy-text-muted/10 flex-wrap">
      <span className="text-galaxy-text-muted text-xs font-body px-1 mr-1 hidden sm:block">{t('editor:a11y.label')}</span>

      <ToolButton
        onClick={isSpeaking ? onStopReading : onReadAloud}
        active={isSpeaking}
        activeColor="galaxy-secondary"
        icon={Volume2}
        activeIcon={VolumeX}
        label={isSpeaking ? t('editor:a11y.stop_reading') : t('editor:a11y.read_aloud')}
        disabled={!ttsSupported}
      />

      <ToolButton
        onClick={isListening ? onStopVoice : onStartVoice}
        active={isListening}
        activeColor="galaxy-accent"
        icon={Mic}
        activeIcon={MicOff}
        label={isListening ? t('editor:a11y.stop_voice') : t('editor:a11y.voice_input')}
        disabled={!voiceSupported}
      />

      <ToolButton
        onClick={toggleDyslexiaFont}
        active={dyslexiaFont}
        activeColor="galaxy-primary"
        icon={Type}
        label={t('editor:a11y.dyslexia_font')}
      />

      <ToolButton
        onClick={toggleFocusMode}
        active={focusMode}
        activeColor="galaxy-primary"
        icon={Maximize2}
        activeIcon={Minimize2}
        label={focusMode ? t('editor:a11y.exit_focus') : t('editor:a11y.focus_mode')}
      />
    </div>
  )
}
