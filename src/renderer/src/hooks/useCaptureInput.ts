import { useEffect, useRef } from 'react'

interface Options {
  device: 'keyboard' | 'gamepad' | null
  onCapture: (value: string | number) => void
  onCancel: () => void
}

/** While `device` is set, captures the next key press or gamepad button press for rebinding. */
export function useCaptureInput({ device, onCapture, onCancel }: Options): void {
  const rafRef = useRef<number>()
  const seenButtonsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!device) return

    if (device === 'keyboard') {
      function handleKeyDown(e: KeyboardEvent): void {
        e.preventDefault()
        if (e.key === 'Escape') {
          onCancel()
          return
        }
        onCapture(e.key)
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }

    // gamepad: record buttons already held so we only react to a fresh press
    seenButtonsRef.current = new Set()
    const pads = navigator.getGamepads ? navigator.getGamepads() : []
    for (const pad of pads) {
      if (!pad) continue
      pad.buttons.forEach((btn, index) => {
        if (btn.pressed) seenButtonsRef.current.add(`${pad.index}-${index}`)
      })
    }

    function poll(): void {
      const currentPads = navigator.getGamepads ? navigator.getGamepads() : []
      for (const pad of currentPads) {
        if (!pad) continue
        for (let index = 0; index < pad.buttons.length; index++) {
          const key = `${pad.index}-${index}`
          const pressed = pad.buttons[index].pressed
          if (pressed && !seenButtonsRef.current.has(key)) {
            onCapture(index)
            return
          }
          if (!pressed) seenButtonsRef.current.delete(key)
          else seenButtonsRef.current.add(key)
        }
      }
      rafRef.current = requestAnimationFrame(poll)
    }
    rafRef.current = requestAnimationFrame(poll)

    function handleEscape(e: KeyboardEvent): void {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleEscape)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [device, onCapture, onCancel])
}
