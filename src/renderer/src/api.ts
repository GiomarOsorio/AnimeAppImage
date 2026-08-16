import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type {
  AnimeMetadata,
  ControlsConfig,
  LibraryScanResult,
  Settings,
  WatchProgress
} from '../../shared/types'

// Tauri's listen() is async (returns Promise<UnlistenFn>) while the renderer expects
// Electron's ipcRenderer.on/removeListener shape (subscribe now, get an unsubscribe fn
// back synchronously). Bridge the two: start listening immediately, and if the caller
// unsubscribes before the listen() promise resolves, unlisten as soon as it does.
function subscribe<T>(event: string, callback: (payload: T) => void): () => void {
  let unlisten: (() => void) | null = null
  let cancelled = false
  listen<T>(event, (e) => callback(e.payload)).then((fn) => {
    if (cancelled) fn()
    else unlisten = fn
  })
  return () => {
    cancelled = true
    if (unlisten) unlisten()
  }
}

const api = {
  getLibrary: (): Promise<LibraryScanResult> => invoke('get_library'),
  selectLibraryFolder: (): Promise<string | null> => invoke('select_library_folder'),
  setLibraryPath: (path: string): Promise<string> => invoke('set_library_path', { path }),
  getSettings: (): Promise<Settings> => invoke('get_settings'),
  setMalCredentials: (clientId: string, clientSecret: string): Promise<void> =>
    invoke('set_mal_credentials', { clientId, clientSecret }),
  testMalClientId: (clientId: string): Promise<{ ok: boolean; message: string }> =>
    invoke('test_mal_client_id', { clientId }),
  setControls: (controls: ControlsConfig): Promise<void> => invoke('set_controls', { next: controls }),
  resetControls: (): Promise<ControlsConfig> => invoke('reset_controls'),
  toggleFavorite: (animeName: string): Promise<string[]> => invoke('toggle_favorite', { name: animeName }),
  fetchMetadata: (title: string, animePath: string, force?: boolean): Promise<AnimeMetadata | null> =>
    invoke('fetch_metadata', { title, animePath, force }),
  getWatchProgress: (): Promise<Record<string, WatchProgress>> => invoke('get_watch_progress'),
  setWatchProgress: (
    episodePath: string,
    animeName: string,
    position: number,
    duration: number
  ): Promise<void> => invoke('set_watch_progress', { episodePath, animeName, position, duration }),
  setScanOnStart: (value: boolean): Promise<void> => invoke('set_scan_on_start', { value }),
  findSubtitle: (episodePath: string): Promise<string | null> => invoke('find_subtitle', { episodePath }),
  runLibraryUpdate: (): Promise<{ ok: boolean; message: string }> => invoke('run_library_update'),
  runLibraryDownload: (): Promise<{ ok: boolean; message: string }> => invoke('run_library_download'),
  onLibraryUpdateStarted: (callback: () => void): (() => void) =>
    subscribe('library:update:started', () => callback()),
  onLibraryUpdateOutput: (callback: (line: string) => void): (() => void) =>
    subscribe<string>('library:update:output', callback),
  onLibraryUpdateDone: (callback: (result: { ok: boolean; message: string }) => void): (() => void) =>
    subscribe('library:update:done', callback),
  onLibraryDownloadStarted: (callback: () => void): (() => void) =>
    subscribe('library:download:started', () => callback()),
  onLibraryDownloadOutput: (callback: (line: string) => void): (() => void) =>
    subscribe<string>('library:download:output', callback),
  onLibraryDownloadDone: (callback: (result: { ok: boolean; message: string }) => void): (() => void) =>
    subscribe('library:download:done', callback),
  logMessage: (level: 'info' | 'warn' | 'error', message: string): Promise<void> =>
    invoke('log_message', { level, message }),
  getMediaPort: (): Promise<number> => invoke('get_media_port'),
  quit: (): Promise<void> => invoke('quit')
}

export type Api = typeof api

declare global {
  interface Window {
    api: Api
  }
}

window.api = api
