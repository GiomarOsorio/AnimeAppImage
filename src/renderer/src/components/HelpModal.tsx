import { useCallback } from 'react'
import { NAV_ACTIONS, NAV_ACTION_LABELS, type ControlsConfig, type NavAction } from '../../../shared/types'
import { useControllerNav } from '../hooks/useControllerNav'

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

interface Props {
  controls: ControlsConfig
  onClose: () => void
}

export default function HelpModal({ controls, onClose }: Props): JSX.Element {
  const onAction = useCallback(
    (action: NavAction) => {
      if (action === 'back' || action === 'confirm' || action === 'help') onClose()
    },
    [onClose]
  )

  useControllerNav({ onAction, controls, enabled: true })

  return (
    <div className="modal-overlay">
      <div className="modal help-modal">
        <h2>Controles</h2>
        <table>
          <thead>
            <tr>
              <th>Acción</th>
              <th>Teclado</th>
              <th>Control</th>
            </tr>
          </thead>
          <tbody>
            {NAV_ACTIONS.map((action) => (
              <tr key={action}>
                <td>{NAV_ACTION_LABELS[action]}</td>
                <td>{controls.keyboard[action]}</td>
                <td>
                  {GAMEPAD_BUTTON_LABELS[controls.gamepad[action]] ?? `Botón ${controls.gamepad[action]}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Esc / B para cerrar</p>
      </div>
    </div>
  )
}
