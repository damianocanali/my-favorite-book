import { useEffect } from 'react'
import { useMilestoneStore } from '../../stores/useMilestoneStore'
import MilestoneMoment from './MilestoneMoment'

// Mounted once next to BadgePopup and WelcomeBackMoment. Any screen can
// fire a beat through the store without needing to render the UI itself,
// so the editor doesn't have to own celebration markup.
//
// Auto-dismisses. A child mid-sentence should never have to deal with it,
// which is also why MilestoneMoment is pointer-events-none and sits above
// the tab bar rather than over the text.

const HOLD_MS = 2800

export default function MilestoneHost() {
  const current = useMilestoneStore((s) => s.current)
  const clear = useMilestoneStore((s) => s.clear)

  useEffect(() => {
    if (!current) return
    const t = setTimeout(clear, HOLD_MS)
    return () => clearTimeout(t)
  }, [current, clear])

  return <MilestoneMoment milestone={current} />
}
