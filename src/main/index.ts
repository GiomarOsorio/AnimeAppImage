import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import store from './store'
import { scanLibrary } from './library'
import { fetchMetadata, testMalClientId } from './metadata'
import { getCachedMetadata, setCachedMetadata } from './metadataCache'
import { readLocalMetadata, writeLocalMetadata } from './localMetadata'
import { registerMediaProtocolScheme, registerMediaProtocolHandler } from './mediaProtocol'
import { isLibraryUpdateRunning, runJkanimeDl } from './jkanimeDl'
import type { ControlsConfig } from '../shared/types'
import { DEFAULT_CONTROLS } from '../shared/types'

registerMediaProtocolScheme()

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

  registerMediaProtocolHandler()

  ipcMain.handle('library:get', async () => {
    const libraryPath = store.get('libraryPath')
    if (!libraryPath) return { animes: [], error: null }
    return scanLibrary(libraryPath)
  })

  ipcMain.handle('library:selectFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return store.get('libraryPath')
    store.set('libraryPath', result.filePaths[0])
    return result.filePaths[0]
  })

  ipcMain.handle('library:setPath', (_, path: string) => {
    store.set('libraryPath', path)
    return path
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

  ipcMain.handle('metadata:fetch', async (_, title: string, animePath: string, force?: boolean) => {
    const local = await readLocalMetadata(animePath)
    if (local) return local

    const cached = force ? undefined : getCachedMetadata(title)
    const data = cached !== undefined ? cached : await fetchMetadata(title, store.get('malClientId'))
    if (cached === undefined) setCachedMetadata(title, data)

    if (data) {
      writeLocalMetadata(animePath, data).catch((err) => {
        console.warn(`No se pudo guardar metadata.json en ${animePath}:`, err)
      })
    }

    return data
  })

  ipcMain.handle('progress:get', () => store.get('watchProgress'))

  ipcMain.handle(
    'progress:set',
    (_, episodePath: string, animeName: string, position: number, duration: number) => {
      const watchProgress = store.get('watchProgress')
      watchProgress[episodePath] = { animeName, episodePath, position, duration, updatedAt: Date.now() }
      store.set('watchProgress', watchProgress)
    }
  )

  ipcMain.handle('settings:setScanOnStart', (_, value: boolean) => {
    store.set('scanOnStart', value)
  })

  ipcMain.handle('subtitles:find', (_, episodePath: string) => {
    const vttPath = episodePath.replace(/\.[^./]+$/, '.vtt')
    return existsSync(vttPath) ? vttPath : null
  })

  ipcMain.handle('library:runUpdate', (event) => {
    const libraryPath = store.get('libraryPath')
    if (!libraryPath) return { ok: false, message: 'No hay carpeta configurada.' }
    if (isLibraryUpdateRunning()) return { ok: false, message: 'Ya se está actualizando.' }

    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) runJkanimeDl(libraryPath, window)
    return { ok: true, message: 'Iniciado' }
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
