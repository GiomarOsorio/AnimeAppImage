import { readdir } from 'fs/promises'
import type { Dirent } from 'fs'
import path from 'path'
import type { Anime, Episode, LibraryScanResult, Season } from '../shared/types'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.webm', '.mov'])

// Carpetas propias de la app en la raíz de la librería (no son animes).
const RESERVED_ROOT_FOLDERS = new Set(['logs'])

// Network shares (NAS over SMB/NFS) can hang instead of erroring outright on
// a dropped connection, and transient hiccups (brief disconnects, a share
// still waking up) are common enough to be worth a couple of quiet retries
// before surfacing anything to the user.
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 800
const READDIR_TIMEOUT_MS = 8000

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('TIMEOUT'), { code: 'ETIMEOUT' })), ms))
}

async function readdirResilient(dir: string): Promise<Dirent[]> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await Promise.race([readdir(dir, { withFileTypes: true }), timeout(READDIR_TIMEOUT_MS)])
    } catch (err) {
      lastError = err
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    }
  }
  throw lastError
}

function describeError(err: unknown): string {
  const code = (err as NodeJS.ErrnoException)?.code
  switch (code) {
    case 'ETIMEOUT':
      return 'La carpeta no respondió a tiempo. ¿El NAS está encendido y conectado a la red?'
    case 'ENOENT':
      return 'La carpeta no existe o no está montada.'
    case 'ENOTCONN':
    case 'EHOSTDOWN':
    case 'EHOSTUNREACH':
    case 'ETIMEDOUT':
    case 'ECONNREFUSED':
      return 'No se pudo conectar. Revisá la red o que el NAS esté encendido.'
    case 'ESTALE':
      return 'Se perdió la conexión con la carpeta (punto de montaje inválido). Reconectá el NAS y volvé a intentar.'
    case 'EACCES':
    case 'EPERM':
      return 'Sin permisos para acceder a esa carpeta.'
    default:
      return 'No se pudo leer la carpeta.'
  }
}

async function listDirs(dir: string): Promise<string[]> {
  const entries = await readdirResilient(dir)
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

async function listEpisodes(dir: string): Promise<Episode[]> {
  const entries = await readdirResilient(dir)
  return entries
    .filter((e) => e.isFile() && VIDEO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => ({ name: e.name, path: path.join(dir, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

export async function scanLibrary(rootDir: string): Promise<LibraryScanResult> {
  let animeNames: string[]
  try {
    animeNames = (await listDirs(rootDir)).filter((name) => !RESERVED_ROOT_FOLDERS.has(name.toLowerCase()))
  } catch (err) {
    return { animes: [], error: describeError(err) }
  }

  const animes: Anime[] = []

  for (const animeName of animeNames) {
    const animePath = path.join(rootDir, animeName)
    let seasonNames: string[]
    try {
      seasonNames = await listDirs(animePath)
    } catch {
      // A single series folder failing mid-scan (e.g. the share dropped
      // partway through) shouldn't blank out everything already found.
      continue
    }

    const seasons: Season[] = []
    for (const seasonName of seasonNames) {
      const seasonPath = path.join(animePath, seasonName)
      try {
        const episodes = await listEpisodes(seasonPath)
        if (episodes.length > 0) seasons.push({ name: seasonName, episodes })
      } catch {
        continue
      }
    }

    seasons.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    animes.push({ name: animeName, path: animePath, seasons })
  }

  animes.sort((a, b) => a.name.localeCompare(b.name))
  return { animes, error: null }
}
