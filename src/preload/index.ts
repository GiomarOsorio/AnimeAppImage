import { contextBridge, ipcRenderer } from 'electron'
import type { Anime, AnimeMetadata, ControlsConfig, Settings } from '../shared/types'

const api = {
  getLibrary: (): Promise<Anime[]> => ipcRenderer.invoke('library:get'),
  selectLibraryFolder: (): Promise<string | null> => ipcRenderer.invoke('library:selectFolder'),
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
  fetchMetadata: (title: string): Promise<AnimeMetadata | null> =>
    ipcRenderer.invoke('metadata:fetch', title)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
