import { spawn, type ChildProcess } from 'child_process'
import type { BrowserWindow } from 'electron'

let runningProcess: ChildProcess | null = null

// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE = /\x1b\[[0-9;]*[a-zA-Z]/g

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE, '')
}

export function isLibraryUpdateRunning(): boolean {
  return runningProcess !== null
}

export function runJkanimeDl(libraryPath: string, window: BrowserWindow): void {
  if (runningProcess) return

  const child = spawn('jkanime-dl', [libraryPath, '-y'])
  runningProcess = child

  window.webContents.send('library:update:started')

  function sendOutput(chunk: Buffer): void {
    const text = stripAnsi(chunk.toString())
    if (text.trim()) window.webContents.send('library:update:output', text)
  }

  child.stdout?.on('data', sendOutput)
  child.stderr?.on('data', sendOutput)

  // A failed spawn (e.g. command not found) fires both 'error' and 'close'
  // on some platforms — without this guard, 'close' would run right after
  // and clobber the precise ENOENT message with a generic exit-code one.
  let settled = false

  child.on('error', (err: NodeJS.ErrnoException) => {
    if (settled) return
    settled = true
    runningProcess = null
    const message =
      err.code === 'ENOENT'
        ? 'jkanime-dl no está instalado o no está en el PATH.'
        : `No se pudo ejecutar jkanime-dl: ${err.message}`
    window.webContents.send('library:update:done', { ok: false, message })
  })

  child.on('close', (code) => {
    if (settled) return
    settled = true
    runningProcess = null
    window.webContents.send('library:update:done', {
      ok: code === 0,
      message: code === 0 ? 'Actualización completa.' : `jkanime-dl terminó con código ${code}.`
    })
  })
}
