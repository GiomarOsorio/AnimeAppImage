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
import { initLogger, log, getLogPath, closeLogger } from './logger'
import type { ControlsConfig } from '../shared/types'
import { DEFAULT_CONTROLS } from '../shared/types'

// Bajo gamescope (modo HTPC de Steam), WAYLAND_DISPLAY puede quedar heredado en el
// entorno aunque gamescope no sirva el protocolo Wayland a clientes normales (requiere
// --expose-wayland, que Steam no usa). Si Chromium detecta esa variable intenta conectar
// como cliente Wayland nativo y gamescope nunca completa el handshake -> queda colgado
// cargando para siempre. Forzamos X11, que gamescope sí expone siempre (igual que los juegos).
// El sandbox de Chromium (proceso zygote) necesita namespaces de usuario sin privilegios;
// varios sistemas Linux (Nobara/Fedora incluidos) los restringen por defecto vía AppArmor/
// sysctl, y bajo Steam esa restricción aplica igual. Sin esto el zygote muere fatal
// (zygote_host_impl_linux.cc "Check failed: . : Invalid argument (22)") antes de poder
// crear el proceso de renderer -> la app nunca llega a mostrar nada.
// GPU AMD (driver RADV, "not a conformant Vulkan implementation") bajo Wayland/gamescope:
// Chromium crea la ventana y "pinta" internamente (ready-to-show llega a disparar) pero
// nunca compone nada visible -> pantalla negra permanente aunque todo lo demás funcione.
// Es un problema conocido de Chromium+AMD+Wayland; --disable-gpu-compositing fuerza la
// composición de la ventana por CPU sin tocar la decodificación de video por GPU.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('ozone-platform', 'x11')
  app.commandLine.appendSwitch('ozone-platform-hint', 'x11')
  app.commandLine.appendSwitch('disable-gpu-compositing')
}

initLogger()

process.on('uncaughtException', (err) => {
  log('error', `uncaughtException: ${err.stack || err.message}`)
})
process.on('unhandledRejection', (reason) => {
  log('error', `unhandledRejection: ${reason instanceof Error ? reason.stack : String(reason)}`)
})

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
    log('info', 'window: ready-to-show')
    mainWindow.show()
  })
  mainWindow.on('close', () => log('info', 'window: close event recibido'))
  mainWindow.on('closed', () => log('info', 'window: closed'))
  mainWindow.on('unresponsive', () => log('warn', 'window: no responde (unresponsive)'))
  mainWindow.on('responsive', () => log('info', 'window: vuelve a responder'))

  mainWindow.webContents.on('did-finish-load', () => log('info', 'renderer: did-finish-load'))
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log('error', `renderer: did-fail-load code=${code} desc="${desc}" url=${url}`)
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log('error', `renderer: render-process-gone ${JSON.stringify(details)}`)
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
  log('info', 'app: whenReady')
  electronApp.setAppUserModelId('com.giomarosorio.animeappimage')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('child-process-gone', (_e, details) => {
    log('error', `app: child-process-gone ${JSON.stringify(details)}`)
  })
  app.on('before-quit', () => log('info', 'app: before-quit'))
  app.on('will-quit', () => {
    log('info', 'app: will-quit')
    closeLogger()
  })

  registerMediaProtocolHandler()

  ipcMain.handle('log:write', (_, level: 'info' | 'warn' | 'error', message: string) => {
    log(level, `[renderer] ${message}`)
  })

  ipcMain.handle('log:getPath', () => getLogPath())

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
  log('info', 'app: window-all-closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
