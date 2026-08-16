import { app } from 'electron'
import { existsSync, mkdirSync, createWriteStream, readdirSync, unlinkSync, type WriteStream } from 'fs'
import { join } from 'path'
import store from './store'

const LOG_PREFIX = 'anime-appimage-'
const MAX_LOG_FILES = 15

let stream: WriteStream | null = null
let logPath = ''

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function timestamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

function pruneOldLogs(dir: string): void {
  try {
    const files = readdirSync(dir)
      .filter((f) => f.startsWith(LOG_PREFIX) && f.endsWith('.log'))
      .sort()
    const excess = files.length - MAX_LOG_FILES
    for (let i = 0; i < excess; i++) {
      try {
        unlinkSync(join(dir, files[i]))
      } catch {
        // best-effort cleanup, ignore
      }
    }
  } catch {
    // dir listing failed, skip pruning
  }
}

function startStream(dir: string): string {
  pruneOldLogs(dir)
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const unique = Math.random().toString(16).slice(2, 8)
  logPath = join(dir, `${LOG_PREFIX}${stamp}-${unique}.log`)
  stream = createWriteStream(logPath, { flags: 'a' })

  log('info', `=== Log iniciado: ${logPath} ===`)
  log(
    'info',
    `Plataforma: ${process.platform}, Electron: ${process.versions.electron}, App: ${app.getVersion()}`
  )
  log('info', `argv: ${process.argv.join(' ')}`)
  log(
    'info',
    `Sesión — XDG_SESSION_TYPE=${process.env.XDG_SESSION_TYPE ?? ''} WAYLAND_DISPLAY=${process.env.WAYLAND_DISPLAY ?? ''} DISPLAY=${process.env.DISPLAY ?? ''} SteamDeck=${process.env.SteamDeck ?? ''} SteamGamepadUI=${process.env.SteamGamepadUI ?? ''} SteamOS=${process.env.STEAM_RUNTIME ?? ''}`
  )
  return logPath
}

export function initLogger(): string {
  const libraryPath = store.get('libraryPath') || app.getPath('videos')
  const primaryDir = join(libraryPath, 'logs')
  try {
    if (!existsSync(primaryDir)) mkdirSync(primaryDir, { recursive: true })
    return startStream(primaryDir)
  } catch (err) {
    const fallbackDir = join(app.getPath('userData'), 'logs')
    if (!existsSync(fallbackDir)) mkdirSync(fallbackDir, { recursive: true })
    const path = startStream(fallbackDir)
    log('warn', `No se pudo escribir logs en ${primaryDir} (${(err as Error).message}), usando ${fallbackDir}`)
    return path
  }
}

export function log(level: 'info' | 'warn' | 'error', message: string): void {
  const line = `[${timestamp()}] [${level.toUpperCase()}] ${message}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
  stream?.write(line + '\n')
}

export function getLogPath(): string {
  return logPath
}

export function closeLogger(): void {
  stream?.end()
  stream = null
}
