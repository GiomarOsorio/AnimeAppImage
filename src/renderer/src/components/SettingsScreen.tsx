import { useCallback, useEffect, useRef, useState } from 'react'
import { NAV_ACTIONS, NAV_ACTION_LABELS, type ControlsConfig, type NavAction } from '../../../shared/types'
import { useControllerNav } from '../hooks/useControllerNav'
import { useCaptureInput } from '../hooks/useCaptureInput'
import { gamepadLabel } from '../utils/gamepadLabels'

const TABS = ['Videos', 'MyAnimeList Metadata', 'Controles'] as const

interface Props {
  libraryPath: string | null
  controls: ControlsConfig
  malClientId: string | null
  malClientSecret: string | null
  onControlsChange: (controls: ControlsConfig) => void
  onLibraryPathChange: (path: string) => void
  onOpenHelp: () => void
  onBack: () => void
  disabled: boolean
}

export default function SettingsScreen({
  libraryPath,
  controls,
  malClientId,
  malClientSecret,
  onControlsChange,
  onLibraryPathChange,
  onOpenHelp,
  onBack,
  disabled
}: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState(0)
  const [focusRow, setFocusRow] = useState(-1)
  const [focusCol, setFocusCol] = useState<0 | 1>(0)
  const [editingField, setEditingField] = useState<'clientId' | 'clientSecret' | null>(null)
  const [clientIdDraft, setClientIdDraft] = useState(malClientId ?? '')
  const [clientSecretDraft, setClientSecretDraft] = useState(malClientSecret ?? '')
  const [validated, setValidated] = useState(false)
  const [testStatus, setTestStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [capturingFor, setCapturingFor] = useState<{ action: NavAction; device: 'keyboard' | 'gamepad' } | null>(
    null
  )

  const clientIdInputRef = useRef<HTMLInputElement>(null)
  const clientSecretInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingField === 'clientId') clientIdInputRef.current?.focus()
    if (editingField === 'clientSecret') clientSecretInputRef.current?.focus()
  }, [editingField])

  const rowCount = activeTab === 0 ? 1 : activeTab === 1 ? 4 : NAV_ACTIONS.length + 1

  const onAction = useCallback(
    (action: NavAction) => {
      if (action === 'help') {
        onOpenHelp()
        return
      }

      if (focusRow === -1) {
        if (action === 'left') setActiveTab((t) => (t + TABS.length - 1) % TABS.length)
        if (action === 'right') setActiveTab((t) => (t + 1) % TABS.length)
        if (action === 'down' || action === 'confirm') {
          setFocusRow(0)
          setFocusCol(0)
        }
        if (action === 'back') onBack()
        return
      }

      if (action === 'up') {
        if (focusRow === 0) setFocusRow(-1)
        else setFocusRow((r) => Math.max(0, r - 1))
        return
      }
      if (action === 'down') {
        setFocusRow((r) => Math.min(rowCount - 1, r + 1))
        return
      }
      if (action === 'left' || action === 'right') {
        if (activeTab === 2 && focusRow < NAV_ACTIONS.length) {
          setFocusCol(action === 'left' ? 0 : 1)
        }
        return
      }
      if (action === 'back') {
        onBack()
        return
      }
      if (action === 'confirm') {
        if (activeTab === 0) {
          window.api.selectLibraryFolder().then((path) => {
            if (path) onLibraryPathChange(path)
          })
        } else if (activeTab === 1) {
          if (focusRow === 0) setEditingField('clientId')
          else if (focusRow === 1) setEditingField('clientSecret')
          else if (focusRow === 2) runTest()
          else if (focusRow === 3 && validated) saveCredentials()
        } else if (activeTab === 2) {
          if (focusRow < NAV_ACTIONS.length) {
            setCapturingFor({ action: NAV_ACTIONS[focusRow], device: focusCol === 0 ? 'keyboard' : 'gamepad' })
          } else {
            window.api.resetControls().then(onControlsChange)
          }
        }
      }
    },
    [focusRow, focusCol, activeTab, rowCount, validated, clientIdDraft, clientSecretDraft]
  )

  useControllerNav({
    onAction,
    controls,
    enabled: !disabled && !editingField && !capturingFor
  })

  useCaptureInput({
    device: capturingFor?.device ?? null,
    onCancel: () => setCapturingFor(null),
    onCapture: (value) => {
      if (!capturingFor) return
      const next: ControlsConfig = {
        keyboard: { ...controls.keyboard },
        gamepad: { ...controls.gamepad }
      }
      if (capturingFor.device === 'keyboard') next.keyboard[capturingFor.action] = String(value)
      else next.gamepad[capturingFor.action] = Number(value)
      window.api.setControls(next).then(() => onControlsChange(next))
      setCapturingFor(null)
    }
  })

  function runTest(): void {
    const id = clientIdDraft.trim()
    if (!id) {
      setTestStatus({ ok: false, message: 'Ingresa un Client ID primero' })
      return
    }
    setTesting(true)
    setTestStatus(null)
    window.api.testMalClientId(id).then((result) => {
      setTesting(false)
      setTestStatus(result)
      setValidated(result.ok)
    })
  }

  function saveCredentials(): void {
    window.api.setMalCredentials(clientIdDraft.trim(), clientSecretDraft.trim()).then(() => {
      setSaveMessage('Configuración guardada')
      setValidated(false)
      setTestStatus(null)
    })
  }

  function handleInputBlur(): void {
    setEditingField(null)
  }

  function handleInputKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape' || e.key === controls.keyboard.back) {
      e.preventDefault()
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <div className="settings-screen">
      <h1>Configuración</h1>
      <div className="settings-tabs">
        {TABS.map((tab, index) => (
          <div
            key={tab}
            className={`settings-tab${index === activeTab ? ' active' : ''}${
              focusRow === -1 && index === activeTab ? ' focused' : ''
            }`}
          >
            {tab}
          </div>
        ))}
      </div>

      <div className="settings-content">
        {activeTab === 0 && (
          <div className="settings-tab-panel">
            <p className="hint">Carpeta actual: {libraryPath ?? '(ninguna)'}</p>
            <div className={`settings-row${focusRow === 0 ? ' focused' : ''}`}>Elegir carpeta</div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="settings-tab-panel">
            <div className={`settings-row${focusRow === 0 ? ' focused' : ''}`}>
              <span>Client ID</span>
              <input
                ref={clientIdInputRef}
                type="text"
                value={clientIdDraft}
                onChange={(e) => {
                  setClientIdDraft(e.target.value)
                  setValidated(false)
                  setTestStatus(null)
                  setSaveMessage(null)
                }}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
              />
            </div>
            <div className={`settings-row${focusRow === 1 ? ' focused' : ''}`}>
              <span>Client Secret</span>
              <input
                ref={clientSecretInputRef}
                type="password"
                value={clientSecretDraft}
                onChange={(e) => {
                  setClientSecretDraft(e.target.value)
                  setValidated(false)
                  setTestStatus(null)
                  setSaveMessage(null)
                }}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
              />
            </div>
            <div className={`settings-row${focusRow === 2 ? ' focused' : ''}`}>
              {testing ? 'Probando...' : 'Probar'}
            </div>
            {testStatus && (
              <p className={`hint ${testStatus.ok ? 'ok' : 'error'}`}>{testStatus.message}</p>
            )}
            <div className={`settings-row${focusRow === 3 ? ' focused' : ''}${validated ? '' : ' disabled'}`}>
              Guardar {!validated && '(prueba el Client ID primero)'}
            </div>
            {saveMessage && <p className="hint ok">{saveMessage}</p>}
          </div>
        )}

        {activeTab === 2 && (
          <div className="settings-tab-panel">
            <div className="controls-grid">
              <div className="controls-grid-header">
                <span>Acción</span>
                <span>Teclado</span>
                <span>Control</span>
              </div>
              {NAV_ACTIONS.map((action, index) => (
                <div key={action} className={`controls-grid-row${focusRow === index ? ' focused' : ''}`}>
                  <span>{NAV_ACTION_LABELS[action]}</span>
                  <span
                    className={`bindable${focusRow === index && focusCol === 0 ? ' focused' : ''}${
                      capturingFor?.action === action && capturingFor.device === 'keyboard' ? ' capturing' : ''
                    }`}
                  >
                    {capturingFor?.action === action && capturingFor.device === 'keyboard'
                      ? 'Presiona una tecla...'
                      : controls.keyboard[action]}
                  </span>
                  <span
                    className={`bindable${focusRow === index && focusCol === 1 ? ' focused' : ''}${
                      capturingFor?.action === action && capturingFor.device === 'gamepad' ? ' capturing' : ''
                    }`}
                  >
                    {capturingFor?.action === action && capturingFor.device === 'gamepad'
                      ? 'Presiona un botón...'
                      : gamepadLabel(controls.gamepad[action])}
                  </span>
                </div>
              ))}
            </div>
            <div className={`settings-row${focusRow === NAV_ACTIONS.length ? ' focused' : ''}`}>
              Restaurar valores por defecto
            </div>
          </div>
        )}
      </div>

      <p className="hint">Esc / B para volver</p>
    </div>
  )
}
