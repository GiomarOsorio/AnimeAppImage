import { useCallback, useEffect, useRef, useState } from 'react'
import { NAV_ACTIONS, NAV_ACTION_LABELS, type ControlsConfig, type NavAction } from '../../../shared/types'
import { useControllerNav } from '../hooks/useControllerNav'
import { useCaptureInput } from '../hooks/useCaptureInput'
import { gamepadLabel } from '../utils/gamepadLabels'
import ControlsLegend from './ControlsLegend'
import OnScreenKeyboard from './OnScreenKeyboard'

const TABS = ['Videos', 'MyAnimeList Metadata', 'Controles'] as const

interface Props {
  libraryPath: string | null
  libraryError: string | null
  controls: ControlsConfig
  malClientId: string | null
  malClientSecret: string | null
  scanOnStart: boolean
  animeCount: number
  missingMetadataCount: number
  refetchingMetadata: boolean
  onControlsChange: (controls: ControlsConfig) => void
  onLibraryPathChange: (path: string) => void
  onLibraryPathManualChange: (path: string) => void
  onScanOnStartChange: (value: boolean) => void
  onRescan: () => void
  onRefetchMetadata: () => void
  onOpenHelp: () => void
  onBack: () => void
  disabled: boolean
}

export default function SettingsScreen({
  libraryPath,
  libraryError,
  controls,
  malClientId,
  malClientSecret,
  scanOnStart,
  animeCount,
  missingMetadataCount,
  refetchingMetadata,
  onControlsChange,
  onLibraryPathChange,
  onLibraryPathManualChange,
  onScanOnStartChange,
  onRescan,
  onRefetchMetadata,
  onOpenHelp,
  onBack,
  disabled
}: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState(0)
  const [focusRow, setFocusRow] = useState(-1)
  const [focusCol, setFocusCol] = useState<0 | 1>(0)
  const [editingField, setEditingField] = useState<'clientId' | 'clientSecret' | 'libraryPath' | null>(null)
  const [clientIdDraft, setClientIdDraft] = useState(malClientId ?? '')
  const [clientSecretDraft, setClientSecretDraft] = useState(malClientSecret ?? '')
  const [libraryPathDraft, setLibraryPathDraft] = useState(libraryPath ?? '')
  const [validated, setValidated] = useState(false)
  const [testStatus, setTestStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [capturingFor, setCapturingFor] = useState<{ action: NavAction; device: 'keyboard' | 'gamepad' } | null>(
    null
  )

  const clientIdInputRef = useRef<HTMLInputElement>(null)
  const clientSecretInputRef = useRef<HTMLInputElement>(null)
  const libraryPathInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingField === 'clientId') clientIdInputRef.current?.focus()
    if (editingField === 'clientSecret') clientSecretInputRef.current?.focus()
    if (editingField === 'libraryPath') libraryPathInputRef.current?.focus()
  }, [editingField])

  useEffect(() => {
    setLibraryPathDraft(libraryPath ?? '')
  }, [libraryPath])

  const rowCount = activeTab === 0 ? 5 : activeTab === 1 ? 4 : NAV_ACTIONS.length + 1

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
          if (focusRow === 0) pickFolder()
          else if (focusRow === 1) setEditingField('libraryPath')
          else if (focusRow === 2) onScanOnStartChange(!scanOnStart)
          else if (focusRow === 3) onRescan()
          else if (focusRow === 4 && !refetchingMetadata && missingMetadataCount > 0) onRefetchMetadata()
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
    [
      focusRow,
      focusCol,
      activeTab,
      rowCount,
      validated,
      clientIdDraft,
      clientSecretDraft,
      scanOnStart,
      refetchingMetadata,
      missingMetadataCount
    ]
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

  function appendToClientId(ch: string): void {
    setClientIdDraft((v) => v + ch)
    setValidated(false)
    setTestStatus(null)
    setSaveMessage(null)
  }

  function backspaceClientId(): void {
    setClientIdDraft((v) => v.slice(0, -1))
    setValidated(false)
    setTestStatus(null)
    setSaveMessage(null)
  }

  function pickFolder(): void {
    window.api.selectLibraryFolder().then((path) => {
      if (path) onLibraryPathChange(path)
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

  function handleLibraryPathKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      const path = libraryPathDraft.trim()
      if (path) onLibraryPathManualChange(path)
      e.currentTarget.blur()
      return
    }
    if (e.key === 'Escape' || e.key === controls.keyboard.back) {
      e.preventDefault()
      setLibraryPathDraft(libraryPath ?? '')
      e.currentTarget.blur()
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
            onClick={() => {
              setActiveTab(index)
              setFocusRow(-1)
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      <div className="settings-content">
        {activeTab === 0 && (
          <div className="settings-tab-panel">
            <div className="settings-folder-box">
              <div className="settings-folder-label">Carpeta actual</div>
              <div className="settings-folder-path">{libraryPath ?? '(ninguna)'}</div>
            </div>
            {libraryError && <p className="hint error">{libraryError}</p>}
            <div
              className={`settings-row${focusRow === 0 ? ' focused' : ''}`}
              onClick={() => {
                setFocusRow(0)
                pickFolder()
              }}
            >
              <div>
                <div className="settings-row-title">Elegir carpeta</div>
                <div className="settings-row-desc">Abre el diálogo del sistema y vuelve a escanear la biblioteca.</div>
              </div>
            </div>
            <div className={`settings-row${focusRow === 1 ? ' focused' : ''}`} onClick={() => setFocusRow(1)}>
              <div>
                <div className="settings-row-title">Ruta manual</div>
                <div className="settings-row-desc">
                  Para carpetas de red (NAS) ya montadas: pegá la ruta y presioná Enter.
                </div>
              </div>
              <input
                ref={libraryPathInputRef}
                type="text"
                value={libraryPathDraft}
                placeholder="/Volumes/NAS/Anime"
                onChange={(e) => setLibraryPathDraft(e.target.value)}
                onFocus={() => {
                  setFocusRow(1)
                  setEditingField('libraryPath')
                }}
                onBlur={handleInputBlur}
                onKeyDown={handleLibraryPathKeyDown}
              />
            </div>
            <div
              className={`settings-row${focusRow === 2 ? ' focused' : ''}`}
              onClick={() => {
                setFocusRow(2)
                onScanOnStartChange(!scanOnStart)
              }}
            >
              <span>Escanear al iniciar</span>
              <div className={`settings-toggle${scanOnStart ? ' on' : ''}`}>
                <div className="settings-toggle-knob" />
              </div>
            </div>
            <div
              className={`settings-row${focusRow === 3 ? ' focused' : ''}`}
              onClick={() => {
                setFocusRow(3)
                onRescan()
              }}
            >
              <span>Reescanear ahora</span>
              <span className="settings-row-meta">
                {animeCount} series · {missingMetadataCount} sin metadata
              </span>
            </div>
            <div
              className={`settings-row${focusRow === 4 ? ' focused' : ''}${
                missingMetadataCount === 0 ? ' disabled' : ''
              }`}
              onClick={() => {
                if (missingMetadataCount === 0 || refetchingMetadata) return
                setFocusRow(4)
                onRefetchMetadata()
              }}
            >
              <span>Actualizar metadata</span>
              <span className="settings-row-meta">
                {refetchingMetadata
                  ? 'Buscando...'
                  : missingMetadataCount === 0
                    ? 'Todo tiene metadata'
                    : `${missingMetadataCount} sin datos`}
              </span>
            </div>
            <p className="hint">
              Estructura esperada: Serie / Temporada / EP01.mp4 · .mp4 .mkv .avi .webm .mov
            </p>
          </div>
        )}

        {activeTab === 1 && (
          <div className="settings-tab-panel">
            <div className={`settings-row${focusRow === 0 ? ' focused' : ''}`} onClick={() => setFocusRow(0)}>
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
                onFocus={() => {
                  setFocusRow(0)
                  setEditingField('clientId')
                }}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
              />
            </div>
            {editingField === 'clientId' && (
              <OnScreenKeyboard onKey={appendToClientId} onBackspace={backspaceClientId} onSpace={() => appendToClientId(' ')} />
            )}
            <div className={`settings-row${focusRow === 1 ? ' focused' : ''}`} onClick={() => setFocusRow(1)}>
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
                onFocus={() => {
                  setFocusRow(1)
                  setEditingField('clientSecret')
                }}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
              />
            </div>
            <div
              className={`settings-row${focusRow === 2 ? ' focused' : ''}`}
              onClick={() => {
                setFocusRow(2)
                runTest()
              }}
            >
              {testing ? 'Probando...' : 'Probar'}
            </div>
            {testStatus && (
              <p className={`hint ${testStatus.ok ? 'ok' : 'error'}`}>{testStatus.message}</p>
            )}
            <div
              className={`settings-row${focusRow === 3 ? ' focused' : ''}${validated ? '' : ' disabled'}`}
              onClick={() => {
                if (!validated) return
                setFocusRow(3)
                saveCredentials()
              }}
            >
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
                    onClick={() => {
                      setFocusRow(index)
                      setFocusCol(0)
                      setCapturingFor({ action, device: 'keyboard' })
                    }}
                  >
                    {capturingFor?.action === action && capturingFor.device === 'keyboard'
                      ? 'Presiona una tecla...'
                      : controls.keyboard[action]}
                  </span>
                  <span
                    className={`bindable${focusRow === index && focusCol === 1 ? ' focused' : ''}${
                      capturingFor?.action === action && capturingFor.device === 'gamepad' ? ' capturing' : ''
                    }`}
                    onClick={() => {
                      setFocusRow(index)
                      setFocusCol(1)
                      setCapturingFor({ action, device: 'gamepad' })
                    }}
                  >
                    {capturingFor?.action === action && capturingFor.device === 'gamepad'
                      ? 'Presiona un botón...'
                      : gamepadLabel(controls.gamepad[action])}
                  </span>
                </div>
              ))}
            </div>
            <div
              className={`settings-row${focusRow === NAV_ACTIONS.length ? ' focused' : ''}`}
              onClick={() => {
                setFocusRow(NAV_ACTIONS.length)
                window.api.resetControls().then(onControlsChange)
              }}
            >
              Restaurar valores por defecto
            </div>
          </div>
        )}
      </div>

      <ControlsLegend
        items={[
          { key: 'A', label: 'Seleccionar', tone: 'accent' },
          { key: 'B', label: 'Volver' }
        ]}
      />
    </div>
  )
}
