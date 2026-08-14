import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import store from './store'
import { scanLibrary } from './library'
import { fetchMetadata, testMalClientId } from './metadata'
import { getCachedMetadata, setCachedMetadata } from './metadataCache'
import type { ControlsConfig } from '../shared/types'
import { DEFAULT_CONTROLS } from '../shared/types'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: !is.dev,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.giomarosorio.animeappimage')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('library:get', async () => {
    const libraryPath = store.get('libraryPath')
    if (!libraryPath) return []
    return scanLibrary(libraryPath)
  })

  ipcMain.handle('library:selectFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return store.get('libraryPath')
    store.set('libraryPath', result.filePaths[0])
    return result.filePaths[0]
  })

  ipcMain.handle('settings:get', () => store.store)

  ipcMain.handle('settings:setMalCredentials', (_, clientId: string, clientSecret: string) => {
    store.set('malClientId', clientId || null)
    store.set('malClientSecret', clientSecret || null)
  })

  ipcMain.handle('mal:testClientId', (_, clientId: string) => testMalClientId(clientId))

  ipcMain.handle('settings:setControls', (_, controls: ControlsConfig) => {
    store.set('controls', controls)
  })

  ipcMain.handle('settings:resetControls', () => {
    store.set('controls', DEFAULT_CONTROLS)
    return DEFAULT_CONTROLS
  })

  ipcMain.handle('favorites:toggle', (_, animeName: string) => {
    const favorites = store.get('favorites')
    const idx = favorites.indexOf(animeName)
    if (idx >= 0) favorites.splice(idx, 1)
    else favorites.push(animeName)
    store.set('favorites', favorites)
    return favorites
  })

  ipcMain.handle('metadata:fetch', async (_, title: string) => {
    const cached = getCachedMetadata(title)
    if (cached !== undefined) return cached

    const data = await fetchMetadata(title, store.get('malClientId'))
    setCachedMetadata(title, data)
    return data
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
