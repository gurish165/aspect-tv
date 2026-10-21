import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEV_URL = 'http://localhost:5173'
const DRAG_INTERVAL = 1000 / 120
const SAVE_DELAY = 400
const DEFAULT_SIZE = { width: 1280, height: 720 }

const here = dirname(fileURLToPath(import.meta.url))
const devMode = process.argv.includes('--dev')
const statePath = join(app.getPath('userData'), 'window-state.json')

function readState() {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    return {}
  }
}

// Bounds, the lock, and settings live in this machine's user data, so each machine keeps its own.
let state = readState()
let saveTimer

function saveState(patch) {
  state = { ...state, ...patch }
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      writeFileSync(statePath, JSON.stringify(state))
    } catch {
      // Losing remembered bounds or settings is harmless.
    }
  }, SAVE_DELAY)
}

function visibleBounds(bounds) {
  if (!bounds) return undefined
  const onScreen = screen.getAllDisplays().some(({ workArea }) => {
    const overlapX =
      Math.min(bounds.x + bounds.width, workArea.x + workArea.width) -
      Math.max(bounds.x, workArea.x)
    const overlapY =
      Math.min(bounds.y + bounds.height, workArea.y + workArea.height) -
      Math.max(bounds.y, workArea.y)
    return overlapX >= 80 && overlapY >= 80
  })
  return onScreen ? bounds : undefined
}

function applyLock(window, locked) {
  window.setMovable(!locked)
  window.setResizable(!locked)
  window.setMaximizable(!locked)
}

function createWindow() {
  const bounds = visibleBounds(state.bounds)
  const locked = state.locked === true
  const window = new BrowserWindow({
    ...DEFAULT_SIZE,
    ...bounds,
    minWidth: 160,
    minHeight: 90,
    frame: false,
    // Let a drag start on the first click even when another app is focused.
    acceptFirstMouse: true,
    movable: !locked,
    resizable: !locked,
    maximizable: !locked,
    backgroundColor: '#07080b',
    show: false,
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.once('ready-to-show', () => {
    // macOS can nudge new windows near the menu bar, so pin the exact bounds before showing.
    if (bounds) window.setBounds(bounds)
    window.show()
  })

  const search = typeof state.search === 'string' ? state.search : ''
  if (devMode) {
    void window.loadURL(`${DEV_URL}/${search}`)
  } else {
    void window.loadFile(join(here, '..', 'dist', 'index.html'), {
      search: search.replace(/^\?/, ''),
    })
  }

  // The app keeps its settings in the URL; remember them between launches.
  window.webContents.on('did-navigate-in-page', (_event, url) => {
    saveState({ search: new URL(url).search })
  })

  // While locked, the saved bounds are the pinned spot, so only track moves when unlocked.
  const rememberBounds = () => {
    if (state.locked || window.isFullScreen() || window.isMinimized()) return
    saveState({ bounds: window.getBounds() })
  }
  window.on('resize', rememberBounds)
  window.on('move', rememberBounds)

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(devMode ? DEV_URL : 'file://')) event.preventDefault()
  })

  return window
}

ipcMain.handle('lock:get', () => state.locked === true)

ipcMain.handle('lock:set', (event, locked) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) return state.locked === true
  stopDrag(window)
  const patch = { locked: Boolean(locked) }
  if (patch.locked && !window.isFullScreen()) patch.bounds = window.getBounds()
  saveState(patch)
  applyLock(window, patch.locked)
  return patch.locked
})

// Without a title bar, the background itself moves the window. Track the cursor from the
// main process so fast drags keep up even when the pointer leaves the window.
const drags = new Map()

function stopDrag(window) {
  clearInterval(drags.get(window)?.timer)
  drags.delete(window)
}

ipcMain.on('drag:start', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || !window.isMovable() || window.isFullScreen()) return
  stopDrag(window)
  const cursor = screen.getCursorScreenPoint()
  const [x, y] = window.getPosition()
  const timer = setInterval(() => {
    if (window.isDestroyed()) return stopDrag(window)
    const now = screen.getCursorScreenPoint()
    const nextX = x + now.x - cursor.x
    const nextY = y + now.y - cursor.y
    const [currentX, currentY] = window.getPosition()
    if (nextX !== currentX || nextY !== currentY) window.setPosition(nextX, nextY)
  }, DRAG_INTERVAL)
  drags.set(window, { timer })
  window.once('blur', () => stopDrag(window))
  window.once('closed', () => stopDrag(window))
})

ipcMain.on('drag:end', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window) stopDrag(window)
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
