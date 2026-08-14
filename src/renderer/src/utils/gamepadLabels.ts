const GAMEPAD_BUTTON_LABELS: Record<number, string> = {
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  8: 'Select',
  9: 'Start',
  12: 'D-pad ↑',
  13: 'D-pad ↓',
  14: 'D-pad ←',
  15: 'D-pad →'
}

export function gamepadLabel(index: number): string {
  return GAMEPAD_BUTTON_LABELS[index] ?? `Botón ${index}`
}
