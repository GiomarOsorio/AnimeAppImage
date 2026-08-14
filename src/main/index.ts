import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import store from './store'
import { scanLibrary } from './library'
import { fetchMetadata } from './metadata'

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
  electronApp.setAppUserModelId('com.anime.library')

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

  ipcMain.handle('settings:setUseMetadata', (_, value: boolean) => {
    store.set('useMetadata', value)
    return value
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
    if (!store.get('useMetadata')) return null
    return fetchMetadata(title)
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
