import type { ControlsConfig } from '../../../shared/types'

interface Props {
  controls: ControlsConfig
  onOpenSettings: () => void
  onOpenHelp: () => void
}

export default function TopBar({ controls, onOpenSettings, onOpenHelp }: Props): JSX.Element {
  return (
    <div className="top-bar">
      <button className="top-bar-pill" onClick={onOpenHelp}>
        Ayuda <span className="key-hint">({controls.keyboard.help})</span>
      </button>
      <button className="top-bar-pill" onClick={onOpenSettings}>
        Configuración <span className="key-hint">({controls.keyboard.settings})</span>
      </button>
    </div>
  )
}
