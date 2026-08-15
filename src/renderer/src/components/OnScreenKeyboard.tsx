const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '_', '.', '@', ':'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'A', 'S', 'D', 'F', 'G'],
  ['H', 'J', 'K', 'L', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '/', '+', '=', '?']
]

interface Props {
  onKey: (char: string) => void
  onBackspace: () => void
  onSpace: () => void
}

// mousedown preventDefault keeps the underlying text input focused, so the
// keyboard doesn't disappear (via the input's onBlur) after every keypress.
function keepFocus(e: React.MouseEvent): void {
  e.preventDefault()
}

export default function OnScreenKeyboard({ onKey, onBackspace, onSpace }: Props): JSX.Element {
  return (
    <div className="onscreen-keyboard">
      <div className="onscreen-keyboard-label">Teclado en pantalla</div>
      {ROWS.map((row, i) => (
        <div className="onscreen-keyboard-row" key={i}>
          {row.map((k) => (
            <button key={k} type="button" className="onscreen-key" onMouseDown={keepFocus} onClick={() => onKey(k)}>
              {k}
            </button>
          ))}
        </div>
      ))}
      <div className="onscreen-keyboard-row">
        <button
          type="button"
          className="onscreen-key onscreen-key--space"
          onMouseDown={keepFocus}
          onClick={onSpace}
        >
          espacio
        </button>
        <button
          type="button"
          className="onscreen-key onscreen-key--wide"
          onMouseDown={keepFocus}
          onClick={onBackspace}
        >
          borrar
        </button>
      </div>
    </div>
  )
}
