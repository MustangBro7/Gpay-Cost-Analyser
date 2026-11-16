'use client'

import * as React from "react"

const DOUBLE_TAP_MS = 320
const DOUBLE_TAP_SLOP_PX = 32

/** True on touch-first devices (phones, tablets), where there's no hover and no precise pointer. */
export function useIsTouchDevice() {
  return React.useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(hover: none) and (pointer: coarse)")
      query.addEventListener("change", onChange)
      return () => query.removeEventListener("change", onChange)
    },
    () => window.matchMedia("(hover: none) and (pointer: coarse)").matches,
    () => false
  )
}

/**
 * Detects a double tap from touch input only (mouse and pen are ignored, so desktop
 * double-clicks keep their normal behaviour). `enabled` is read at the first tap, so a tap
 * that changes state (e.g. drilling into a slice) can't be completed into a double tap.
 * Spread the returned handlers on the element and pair it with `touch-action: manipulation`
 * so the browser doesn't zoom on the same gesture. The click that follows the second tap is
 * swallowed, so it can't select whatever the reset just drew under the finger.
 */
export function useDoubleTap(onDoubleTap: () => void, enabled: boolean) {
  const lastTapRef = React.useRef<{ time: number; x: number; y: number; enabled: boolean } | null>(null)
  const suppressClickUntilRef = React.useRef(0)
  const callbackRef = React.useRef(onDoubleTap)

  React.useEffect(() => {
    callbackRef.current = onDoubleTap
  }, [onDoubleTap])

  const onPointerUp = React.useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== "touch") {
        lastTapRef.current = null
        return
      }

      const now = event.timeStamp
      const last = lastTapRef.current
      const isDoubleTap =
        last !== null &&
        last.enabled &&
        now - last.time < DOUBLE_TAP_MS &&
        Math.hypot(event.clientX - last.x, event.clientY - last.y) < DOUBLE_TAP_SLOP_PX

      if (isDoubleTap) {
        lastTapRef.current = null
        suppressClickUntilRef.current = now + DOUBLE_TAP_MS
        callbackRef.current()
        return
      }

      lastTapRef.current = { time: now, x: event.clientX, y: event.clientY, enabled }
    },
    [enabled]
  )

  // A scroll or long-press shouldn't count as the first half of a double tap.
  const onPointerCancel = React.useCallback(() => {
    lastTapRef.current = null
  }, [])

  const onClickCapture = React.useCallback((event: React.MouseEvent) => {
    if (event.timeStamp < suppressClickUntilRef.current) {
      event.stopPropagation()
      event.preventDefault()
    }
  }, [])

  return { onPointerUp, onPointerCancel, onClickCapture }
}
