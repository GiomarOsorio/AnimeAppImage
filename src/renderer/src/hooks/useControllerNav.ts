import { useEffect, useRef } from 'react'

export type NavAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'toggleFavorite'

interface Options {
  onAction: (action: NavAction) => void
  enabled?: boolean
}

const KEY_MAP: Record<string, NavAction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'confirm',
  ' ': 'confirm',
  Escape: 'back',
  Backspace: 'back',
  f: 'toggleFavorite'
}

// Standard gamepad mapping button indices (Xbox/Steam Controller/most XInput-style pads)
const BUTTON_MAP: Record<number, NavAction> = {
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
  0: 'confirm', // A
  1: 'back', // B
  3: 'toggleFavorite' // Y
}

const REPEAT_DELAY_MS = 220
const AXIS_THRESHOLD = 0.5

export function useControllerNav({ onAction, enabled = true }: Options): void {
  const lastPressRef = useRef<Record<string, number>>({})
  const rafRef = useRef<number>()

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent): void {
      const action = KEY_MAP[e.key]
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
          const action = BUTTON_MAP[index]
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
          y < -AXIS_THRESHOLD ? 'up' : y > AXIS_THRESHOLD ? 'down' : x < -AXIS_THRESHOLD ? 'left' : x > AXIS_THRESHOLD ? 'right' : null

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
  }, [onAction, enabled])
}
