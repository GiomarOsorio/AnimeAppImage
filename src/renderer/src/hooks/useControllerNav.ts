import { useEffect, useRef } from 'react'
import type { ControlsConfig, NavAction } from '../../../shared/types'

export type { NavAction }

interface Options {
  onAction: (action: NavAction) => void
  controls: ControlsConfig
  enabled?: boolean
}

const REPEAT_DELAY_MS = 220
const AXIS_THRESHOLD = 0.5

function invert<T extends string | number>(map: Record<NavAction, T>): Map<T, NavAction> {
  const out = new Map<T, NavAction>()
  for (const key of Object.keys(map) as NavAction[]) {
    out.set(map[key], key)
  }
  return out
}

export function useControllerNav({ onAction, controls, enabled = true }: Options): void {
  const lastPressRef = useRef<Record<string, number>>({})
  const rafRef = useRef<number>()

  useEffect(() => {
    if (!enabled) return

    const keyMap = invert(controls.keyboard)
    const buttonMap = invert(controls.gamepad)

    function handleKeyDown(e: KeyboardEvent): void {
      const action = keyMap.get(e.key)
      if (!action) return
      e.preventDefault()
      onAction(action)
    }
    window.addEventListener('keydown', handleKeyDown)

    function pollGamepads(): void {
      const pads = navigator.getGamepads ? navigator.getGamepads() : []
      const now = performance.now()

      for (const pad of pads) {
        if (!pad) continue

        pad.buttons.forEach((btn, index) => {
          const action = buttonMap.get(index)
          if (!action) return
          const key = `btn-${pad.index}-${index}`
          if (btn.pressed) {
            const last = lastPressRef.current[key] ?? 0
            if (now - last > REPEAT_DELAY_MS) {
              lastPressRef.current[key] = now
              onAction(action)
            }
          } else {
            lastPressRef.current[key] = 0
          }
        })

        // Left stick as d-pad fallback
        const [x, y] = pad.axes
        const axisAction: NavAction | null =
          y < -AXIS_THRESHOLD
            ? 'up'
            : y > AXIS_THRESHOLD
              ? 'down'
              : x < -AXIS_THRESHOLD
                ? 'left'
                : x > AXIS_THRESHOLD
                  ? 'right'
                  : null

        if (axisAction) {
          const key = `axis-${pad.index}`
          const last = lastPressRef.current[key] ?? 0
          if (now - last > REPEAT_DELAY_MS) {
            lastPressRef.current[key] = now
            onAction(axisAction)
          }
        } else {
          lastPressRef.current[`axis-${pad.index}`] = 0
        }
      }

      rafRef.current = requestAnimationFrame(pollGamepads)
    }
    rafRef.current = requestAnimationFrame(pollGamepads)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [onAction, controls, enabled])
}
