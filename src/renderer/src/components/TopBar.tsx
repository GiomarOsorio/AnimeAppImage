import type { ControlsConfig } from '../../../shared/types'
import { gamepadLabel } from '../utils/gamepadLabels'

interface Props {
  controls: ControlsConfig
  onOpenSettings: () => void
  onOpenHelp: () => void
}

export default function TopBar({ controls, onOpenSettings, onOpenHelp }: Props): JSX.Element {
  return (
    <div className="top-bar">
      <div className="top-bar-brand">
        <div className="brand-mark" />
        <div className="brand-name">AnimeAppImage</div>
      </div>
      <div className="top-bar-actions">
        <button className="top-bar-pill" onClick={onOpenHelp}>
          <span>Ayuda</span>
          <span className="key-hint">{gamepadLabel(controls.gamepad.help)}</span>
        </button>
        <button className="top-bar-pill" onClick={onOpenSettings}>
          <span>Configuración</span>
          <span className="key-hint">{gamepadLabel(controls.gamepad.settings)}</span>
        </button>
      </div>
    </div>
  )
}
