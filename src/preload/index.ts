import { contextBridge, ipcRenderer } from 'electron'
import type { Anime, AnimeMetadata, Settings } from '../shared/types'

const api = {
  getLibrary: (): Promise<Anime[]> => ipcRenderer.invoke('library:get'),
  selectLibraryFolder: (): Promise<string | null> => ipcRenderer.invoke('library:selectFolder'),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setUseMetadata: (value: boolean): Promise<boolean> =>
    ipcRenderer.invoke('settings:setUseMetadata', value),
  toggleFavorite: (animeName: string): Promise<string[]> =>
    ipcRenderer.invoke('favorites:toggle', animeName),
  fetchMetadata: (title: string): Promise<AnimeMetadata | null> =>
    ipcRenderer.invoke('metadata:fetch', title)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
