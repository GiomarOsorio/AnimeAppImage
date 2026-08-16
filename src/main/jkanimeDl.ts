import { spawn, type ChildProcess } from 'child_process'
import type { BrowserWindow } from 'electron'

export type JkanimeDlJob = 'update' | 'download'

let runningProcess: ChildProcess | null = null
let runningJob: JkanimeDlJob | null = null

// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE = /\x1b\[[0-9;]*[a-zA-Z]/g

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE, '')
}

export function isJkanimeDlRunning(): boolean {
  return runningProcess !== null
}

export function runningJkanimeDlJob(): JkanimeDlJob | null {
  return runningJob
}

export function runJkanimeDl(args: string[], job: JkanimeDlJob, window: BrowserWindow): void {
  if (runningProcess) return

  const child = spawn('jkanime-dl', args)
  runningProcess = child
  runningJob = job

  window.webContents.send(`library:${job}:started`)

  function sendOutput(chunk: Buffer): void {
    const text = stripAnsi(chunk.toString())
    if (text.trim()) window.webContents.send(`library:${job}:output`, text)
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
    runningJob = null
    const message =
      err.code === 'ENOENT'
        ? 'jkanime-dl no está instalado o no está en el PATH.'
        : `No se pudo ejecutar jkanime-dl: ${err.message}`
    window.webContents.send(`library:${job}:done`, { ok: false, message })
  })

  child.on('close', (code) => {
    if (settled) return
    settled = true
    runningProcess = null
    runningJob = null
    window.webContents.send(`library:${job}:done`, {
      ok: code === 0,
      message: code === 0 ? 'Completado.' : `jkanime-dl terminó con código ${code}.`
    })
  })
}
