import path from 'node:path'
import fs from 'fs/promises'
import { version } from '../package.json'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import started from 'electron-squirrel-startup'
import { updateElectronApp } from 'update-electron-app'
import { startMcpServer, stopMcpServer, getMcpStatus } from './mcp/server'

if (process.platform == 'win32') updateElectronApp()

const isDev = typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined'

const appDataDir = app.getPath('userData')
const customFlagsDir = path.join(appDataDir, 'geojson')

// Ensure directory exists (optional)
fs.mkdir(customFlagsDir, { recursive: true }).catch(console.error)

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit()
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  mainWindow.setMenuBarVisibility(false)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.maximize()
    if (isDev) mainWindow.webContents.openDevTools()

    startMcpServer(mainWindow)
      .then((status) => {
        mainWindow.webContents.send('mcp-status', status)
      })
      .catch((err) => {
        console.error('[mcp] failed to start:', err)
        mainWindow.webContents.send('mcp-status', {
          ...getMcpStatus(),
          listening: false,
          error: String(err?.message ?? err),
        })
      })
  })

  // IPC Listeners
  ipcMain.handle('get-current-version', () => version)
  ipcMain.handle('get-mcp-status', () => getMcpStatus())

  ipcMain.handle('open-geojson-folder', () => {
    shell.openPath(customFlagsDir)
  })

  ipcMain.handle('load-custom-layers', async () => {
    try {
      const files = await fs.readdir(customFlagsDir)
      const geojsonFiles = files.filter((f) => f.endsWith('.json') || f.endsWith('.geojson'))

      const layers = []
      for (const file of geojsonFiles) {
        const fullPath = path.join(customFlagsDir, file)
        const content = await fs.readFile(fullPath, 'utf-8')
        const json = JSON.parse(content)

        layers.push({
          label: file,
          key: file,
          source: json,
          visible: true,
        })
      }

      return layers
    } catch (err) {
      console.error(err)
      return []
    }
  })

  mainWindow.on('close', async (e) => {
    e.preventDefault()
    mainWindow.webContents.send('check-before-close')

    const shouldClose = await new Promise<boolean>((resolve) => {
      ipcMain.once('check-before-close-result', (_event, result) => {
        resolve(result)
      })
    })

    if (shouldClose) {
      mainWindow.destroy()
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  await stopMcpServer().catch((err) => console.error('[mcp] shutdown error:', err))
})
