// Press-and-hold, for touch devices that have no hover.
//
// The gesture logic lives in createLongPressGesture, a plain function with no
// React in it, and useLongPress is a thin wrapper. That split is deliberate:
// this suite runs in a node environment with no DOM, so a hook whose logic sat
// inside React could only be tested by re-implementing it in the test — which
// passes whatever the real code does, and is worth nothing.
//
// What this has to get right, all of it learned from how long presses fail:
//
//   Scrolling must not delete a book. A finger that starts on a spine and then
//   drags to scroll the shelf is scrolling, not holding. Movement past a few
//   pixels cancels, and the browser's own pointercancel (fired when it claims
//   the gesture for panning) cancels too.
//
//   A long press must not ALSO open the book. The browser still fires `click`
//   after the finger lifts, so once the hold has fired the next click is
//   swallowed — and only that one, or the following real tap would be eaten.
//
//   The child must be able to change their mind. Nothing happens on the way
//   down; the caller is told the hold is in progress so it can show what is
//   about to happen, and lifting early cancels with no side effect.
//
//   Holding must not summon the text-selection callout over the shelf.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/// Long enough that a normal tap cannot reach it, short enough that a child
/// does not give up. Deliberately longer than the ~500ms typical of
/// press-and-hold gestures, because this one is destructive.
export const LONG_PRESS_MS = 600

/// How far the finger may drift before this is a drag rather than a hold.
/// Roughly a fingertip's natural wobble — any tighter and a still finger in a
/// moving car would cancel.
export const MOVE_TOLERANCE_PX = 10

/**
 * The gesture as a plain state machine.
 *
 * @param onLongPress   fired once the hold completes
 * @param onClick       fired for a normal tap, never after a completed hold
 * @param onHoldingChange  told when the hold starts and stops, for feedback
 * @param delay         hold duration in ms
 * @param setTimer/clearTimer  injectable so tests can drive time directly
 */
export function createLongPressGesture({
  onLongPress,
  onClick,
  onHoldingChange,
  delay = LONG_PRESS_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let timer = null
  let origin = null
  let fired = false

  const stop = () => {
    if (timer) clearTimer(timer)
    timer = null
    origin = null
    onHoldingChange?.(false)
  }

  return {
    /// Exposed for teardown: a component unmounted mid-hold must not leave a
    /// timer that fires into nothing.
    cancel: stop,

    onPointerDown(e) {
      // Primary button / first touch only. A right-click or a second finger is
      // not a hold, and treating one as a hold makes two-finger scrolling
      // delete things.
      if (e.button != null && e.button !== 0) return
      origin = { x: e.clientX, y: e.clientY }
      fired = false
      onHoldingChange?.(true)
      timer = setTimer(() => {
        fired = true
        timer = null
        onHoldingChange?.(false)
        onLongPress?.()
      }, delay)
    },

    onPointerMove(e) {
      if (!origin) return
      if (
        Math.abs(e.clientX - origin.x) > MOVE_TOLERANCE_PX ||
        Math.abs(e.clientY - origin.y) > MOVE_TOLERANCE_PX
      ) {
        stop()
      }
    },

    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,

    onClick(e) {
      // The hold already did the work; swallow the click the browser sends
      // afterwards so the book does not also open. Reset immediately so the
      // NEXT tap is a real one.
      if (fired) {
        fired = false
        e?.preventDefault?.()
        e?.stopPropagation?.()
        return
      }
      onClick?.(e)
    },

    // Desktop equivalent of the callout a long press raises on touch.
    onContextMenu: (e) => e?.preventDefault?.(),
  }
}

export function useLongPress({ onLongPress, onClick, delay = LONG_PRESS_MS } = {}) {
  const [holding, setHolding] = useState(false)

  // The callbacks are read through a ref so the gesture is built once. Rebuilt
  // every render, an in-progress hold would lose its timer whenever the parent
  // re-rendered — which the shelf does on every store change.
  const cbs = useRef({ onLongPress, onClick })
  cbs.current = { onLongPress, onClick }

  const gesture = useMemo(
    () =>
      createLongPressGesture({
        delay,
        onHoldingChange: setHolding,
        onLongPress: () => cbs.current.onLongPress?.(),
        onClick: (e) => cbs.current.onClick?.(e),
      }),
    [delay]
  )

  useEffect(() => gesture.cancel, [gesture])

  const handlers = useCallback(() => {
    const { cancel, ...rest } = gesture
    return rest
  }, [gesture])()

  return { holding, handlers }
}
