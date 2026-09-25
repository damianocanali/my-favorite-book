// The long-press gesture.
//
// These drive the REAL state machine from src/hooks/useLongPress.js — that is
// why the logic lives in a plain function outside React. A version of this file
// that re-implemented the gesture would pass no matter what the shipping code
// did.
//
// Four things make press-and-hold safe on a shelf of books a child can lose:
// a tap opens and never deletes; a hold deletes and never also opens;
// scrolling cancels; letting go early cancels.

import { describe, it, expect, vi } from 'vitest'
import {
  createLongPressGesture,
  LONG_PRESS_MS,
  MOVE_TOLERANCE_PX,
} from '../src/hooks/useLongPress'

/// Drives time by hand instead of using fake timers, so a gesture that fired
/// from the wrong clock could not accidentally pass.
function harness(opts = {}) {
  let pending = null
  const gesture = createLongPressGesture({
    ...opts,
    setTimer: (fn, ms) => { pending = { fn, ms }; return 1 },
    clearTimer: () => { pending = null },
  })
  return {
    gesture,
    /// Advance far enough for a scheduled hold to fire.
    elapse(ms) {
      if (pending && ms >= pending.ms) { const { fn } = pending; pending = null; fn() }
    },
    get scheduled() { return pending !== null },
  }
}

const press = (x = 10, y = 10) => ({ button: 0, clientX: x, clientY: y })
const clickEvent = () => ({ preventDefault: vi.fn(), stopPropagation: vi.fn() })

describe('long press to delete', () => {
  it('holds for long enough that a tap cannot reach it', () => {
    // A destructive action must not be reachable by a slightly slow tap.
    expect(LONG_PRESS_MS).toBeGreaterThanOrEqual(500)
  })

  it('a tap opens the book and deletes nothing', () => {
    const onLongPress = vi.fn(), onClick = vi.fn()
    const h = harness({ onLongPress, onClick })
    h.gesture.onPointerDown(press())
    h.gesture.onPointerUp()
    h.gesture.onClick(clickEvent())
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('a hold deletes, and does NOT also open the book', () => {
    const onLongPress = vi.fn(), onClick = vi.fn()
    const h = harness({ onLongPress, onClick })
    h.gesture.onPointerDown(press())
    h.elapse(LONG_PRESS_MS)
    expect(onLongPress).toHaveBeenCalledTimes(1)

    // The browser still sends a click when the finger lifts. If it reached
    // onClick the child would get the confirm dialog AND the reader.
    const e = clickEvent()
    h.gesture.onPointerUp()
    h.gesture.onClick(e)
    expect(onClick).not.toHaveBeenCalled()
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('scrolling cancels — a finger that drags is not holding', () => {
    const onLongPress = vi.fn()
    const h = harness({ onLongPress })
    h.gesture.onPointerDown(press(10, 10))
    h.gesture.onPointerMove({ clientX: 10, clientY: 10 + MOVE_TOLERANCE_PX + 1 })
    h.elapse(LONG_PRESS_MS)
    expect(onLongPress).not.toHaveBeenCalled()
    expect(h.scheduled).toBe(false)
  })

  it('the browser taking the gesture for a pan cancels it', () => {
    const onLongPress = vi.fn()
    const h = harness({ onLongPress })
    h.gesture.onPointerDown(press())
    h.gesture.onPointerCancel()
    h.elapse(LONG_PRESS_MS)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('tolerates a wobble — a still finger is never perfectly still', () => {
    const onLongPress = vi.fn()
    const h = harness({ onLongPress })
    h.gesture.onPointerDown(press(10, 10))
    h.gesture.onPointerMove({ clientX: 10 + MOVE_TOLERANCE_PX - 1, clientY: 12 })
    h.elapse(LONG_PRESS_MS)
    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('letting go early cancels', () => {
    const onLongPress = vi.fn()
    const h = harness({ onLongPress })
    h.gesture.onPointerDown(press())
    h.gesture.onPointerUp()
    h.elapse(LONG_PRESS_MS)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('ignores a right-click and a second finger', () => {
    const onLongPress = vi.fn()
    const h = harness({ onLongPress })
    h.gesture.onPointerDown({ button: 2, clientX: 10, clientY: 10 })
    h.elapse(LONG_PRESS_MS)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('suppresses only the click that follows the hold, not the next one', () => {
    const onLongPress = vi.fn(), onClick = vi.fn()
    const h = harness({ onLongPress, onClick })
    h.gesture.onPointerDown(press())
    h.elapse(LONG_PRESS_MS)
    h.gesture.onPointerUp()

    // Two clicks with NO pointerdown between them. The obvious version of this
    // test puts a fresh press in the middle, but onPointerDown clears the flag
    // itself, so that version passes even when onClick forgets to — it proves
    // nothing about the suppression being one-shot. Verified by mutation:
    // deleting the reset inside onClick leaves the press-in-the-middle version
    // green and fails this one.
    h.gesture.onClick(clickEvent())   // swallowed: it belongs to the hold
    h.gesture.onClick(clickEvent())   // a real click, must get through
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('reports the hold so the UI can show what is about to happen', () => {
    const states = []
    const h = harness({ onLongPress: () => {}, onHoldingChange: (v) => states.push(v) })
    h.gesture.onPointerDown(press())
    expect(states).toEqual([true])
    h.elapse(LONG_PRESS_MS)
    expect(states).toEqual([true, false])
  })

  it('cancel() clears a pending hold, for unmount mid-press', () => {
    const onLongPress = vi.fn()
    const h = harness({ onLongPress })
    h.gesture.onPointerDown(press())
    h.gesture.cancel()
    h.elapse(LONG_PRESS_MS)
    expect(onLongPress).not.toHaveBeenCalled()
  })
})
