import { contextBridge, ipcRenderer } from 'electron'
import type { AnimeMetadata, ControlsConfig, LibraryScanResult, Settings, WatchProgress } from '../shared/types'

const api = {
  getLibrary: (): Promise<LibraryScanResult> => ipcRenderer.invoke('library:get'),
  selectLibraryFolder: (): Promise<string | null> => ipcRenderer.invoke('library:selectFolder'),
  setLibraryPath: (path: string): Promise<string> => ipcRenderer.invoke('library:setPath', path),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setMalCredentials: (clientId: string, clientSecret: string): Promise<void> =>
    ipcRenderer.invoke('settings:setMalCredentials', clientId, clientSecret),
  testMalClientId: (clientId: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('mal:testClientId', clientId),
  setControls: (controls: ControlsConfig): Promise<void> =>
    ipcRenderer.invoke('settings:setControls', controls),
  resetControls: (): Promise<ControlsConfig> => ipcRenderer.invoke('settings:resetControls'),
  toggleFavorite: (animeName: string): Promise<string[]> =>
    ipcRenderer.invoke('favorites:toggle', animeName),
  fetchMetadata: (title: string, animePath: string, force?: boolean): Promise<AnimeMetadata | null> =>
    ipcRenderer.invoke('metadata:fetch', title, animePath, force),
  getWatchProgress: (): Promise<Record<string, WatchProgress>> => ipcRenderer.invoke('progress:get'),
  setWatchProgress: (episodePath: string, animeName: string, position: number, duration: number): Promise<void> =>
    ipcRenderer.invoke('progress:set', episodePath, animeName, position, duration),
  setScanOnStart: (value: boolean): Promise<void> => ipcRenderer.invoke('settings:setScanOnStart', value),
  findSubtitle: (episodePath: string): Promise<string | null> =>
    ipcRenderer.invoke('subtitles:find', episodePath),
  runLibraryUpdate: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('library:runUpdate'),
  onLibraryUpdateStarted: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('library:update:started', listener)
    return () => ipcRenderer.removeListener('library:update:started', listener)
  },
  onLibraryUpdateOutput: (callback: (line: string) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, line: string): void => callback(line)
    ipcRenderer.on('library:update:output', listener)
    return () => ipcRenderer.removeListener('library:update:output', listener)
  },
  onLibraryUpdateDone: (callback: (result: { ok: boolean; message: string }) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, result: { ok: boolean; message: string }): void =>
      callback(result)
    ipcRenderer.on('library:update:done', listener)
    return () => ipcRenderer.removeListener('library:update:done', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
