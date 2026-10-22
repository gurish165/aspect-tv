import { app, BrowserWindow, ipcMain, Menu, powerSaveBlocker, screen, shell } from 'electron'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEV_URL = 'http://localhost:5173'
const DRAG_INTERVAL = 1000 / 120
const SAVE_DELAY = 400
const DEFAULT_SIZE = { width: 1280, height: 720 }
const ADMIN_SIZE = { width: 1180, height: 860 }
const RECENT_PLAYS = 300

const here = dirname(fileURLToPath(import.meta.url))
const devMode = process.argv.includes('--dev')
const statePath = join(app.getPath('userData'), 'window-state.json')
const playsPath = join(app.getPath('userData'), 'arcade-plays.jsonl')

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

// Two windows share one page: the TV window players see, and the admin window staff use.
let gameWindow
let adminWindow

function windows() {
  return [gameWindow, adminWindow].filter((window) => window && !window.isDestroyed())
}

function broadcast(channel, payload) {
  for (const window of windows()) window.webContents.send(channel, payload)
}

function loadPage(window, admin) {
  if (devMode) {
    void window.loadURL(`${DEV_URL}/${admin ? '?admin' : ''}`)
  } else {
    void window.loadFile(join(here, '..', 'dist', 'index.html'), { search: admin ? 'admin' : '' })
  }
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(devMode ? DEV_URL : 'file://')) event.preventDefault()
  })
}

function focusState() {
  const alive = (window) => Boolean(window && !window.isDestroyed())
  return {
    game: alive(gameWindow) && gameWindow.isFocused(),
    admin: alive(adminWindow) && adminWindow.isFocused(),
  }
}

function overlap(a, b) {
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return x > 0 && y > 0
}

function windowState() {
  const game = gameWindow && !gameWindow.isDestroyed() ? gameWindow : undefined
  const admin = adminWindow && !adminWindow.isDestroyed() ? adminWindow : undefined
  return {
    locked: state.locked === true,
    fullscreen: Boolean(game?.isFullScreen()),
    // The TV shows the game window's part of the screen, so an overlapping admin window would
    // be visible to players.
    adminOverTv: Boolean(
      game &&
      admin &&
      admin.isVisible() &&
      !admin.isMinimized() &&
      overlap(game.getBounds(), admin.getBounds()),
    ),
  }
}

function announceWindows() {
  broadcast('window:changed', windowState())
}

/** First-run admin placement: beside the TV window, never on top of it. */
function defaultAdminBounds() {
  const game = gameWindow?.getBounds() ?? state.bounds
  if (!game) return undefined
  const { workArea } = screen.getDisplayMatching(game)
  const left = game.x - workArea.x
  const right = workArea.x + workArea.width - (game.x + game.width)
  const height = Math.min(ADMIN_SIZE.height, workArea.height)
  if (Math.max(left, right) >= 560) {
    const width = Math.min(ADMIN_SIZE.width, Math.max(left, right) - 8)
    const x = left >= right ? workArea.x : game.x + game.width + 8
    return { x, y: workArea.y, width, height }
  }
  const below = workArea.y + workArea.height - (game.y + game.height)
  if (below >= 420) {
    return {
      x: workArea.x,
      y: game.y + game.height + 8,
      width: Math.min(ADMIN_SIZE.width, workArea.width),
      height: below - 8,
    }
  }
  return undefined
}

function announceFocus() {
  broadcast('focus:changed', focusState())
}

function createGameWindow() {
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
      // The arcade keeps running at full speed while the admin window has focus.
      backgroundThrottling: false,
    },
  })
  gameWindow = window

  window.once('ready-to-show', () => {
    // macOS can nudge new windows near the menu bar, so pin the exact bounds before showing.
    if (bounds) window.setBounds(bounds)
    window.show()
    window.focus()
  })
  loadPage(window, false)

  // While locked, the saved bounds are the pinned spot, so only track moves when unlocked.
  const rememberBounds = () => {
    if (state.locked || window.isFullScreen() || window.isMinimized()) return
    saveState({ bounds: window.getBounds() })
  }
  window.on('resize', rememberBounds)
  window.on('move', rememberBounds)
  window.on('focus', announceFocus)
  window.on('blur', announceFocus)
  window.on('enter-full-screen', announceWindows)
  window.on('leave-full-screen', announceWindows)
  window.on('moved', announceWindows)
  window.on('resized', announceWindows)
  // The TV window is the app; closing it quits, admin window included.
  window.on('closed', () => {
    gameWindow = undefined
    app.quit()
  })
  return window
}

function createAdminWindow() {
  const saved = visibleBounds(state.adminBounds) ?? defaultAdminBounds()
  const window = new BrowserWindow({
    ...ADMIN_SIZE,
    ...saved,
    minWidth: 560,
    minHeight: 420,
    title: 'Aspect TV Admin',
    backgroundColor: '#0d0f15',
    show: false,
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  adminWindow = window
  // Open without taking the keypad away from the game.
  window.once('ready-to-show', () => {
    if (saved) window.setBounds(saved)
    window.showInactive()
  })
  loadPage(window, true)
  const rememberBounds = () => {
    if (!window.isMinimized() && !window.isFullScreen()) {
      saveState({ adminBounds: window.getBounds() })
    }
  }
  window.on('resize', rememberBounds)
  window.on('move', rememberBounds)
  window.on('moved', announceWindows)
  window.on('resized', announceWindows)
  window.on('show', announceWindows)
  window.on('hide', announceWindows)
  window.on('minimize', announceWindows)
  window.on('restore', announceWindows)
  window.on('focus', announceFocus)
  window.on('blur', announceFocus)
  window.on('closed', () => {
    adminWindow = undefined
    announceFocus()
  })
  return window
}

function showAdmin() {
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.show()
    adminWindow.focus()
  } else {
    createAdminWindow().once('ready-to-show', () => adminWindow?.focus())
  }
}

function focusGame() {
  if (!gameWindow || gameWindow.isDestroyed()) return
  // Bring the app forward too, in case another app had focus.
  app.focus({ steal: true })
  gameWindow.show()
  gameWindow.focus()
}

ipcMain.handle('lock:get', () => state.locked === true)

ipcMain.handle('lock:set', (_event, locked) => {
  // Lock always applies to the TV window, wherever the request came from.
  const window = gameWindow
  if (!window || window.isDestroyed()) return state.locked === true
  stopDrag(window)
  const patch = { locked: Boolean(locked) }
  if (patch.locked && !window.isFullScreen()) patch.bounds = window.getBounds()
  saveState(patch)
  applyLock(window, patch.locked)
  announceWindows()
  return patch.locked
})

ipcMain.handle('window:get', () => windowState())

ipcMain.on('window:fullscreen', () => {
  if (gameWindow && !gameWindow.isDestroyed()) {
    gameWindow.setFullScreen(!gameWindow.isFullScreen())
  }
})

ipcMain.handle('focus:get', () => focusState())
ipcMain.on('focus:game', () => focusGame())
ipcMain.on('admin:show', () => showAdmin())

// Settings: the main process keeps the one copy, saves it, and sends every change to both
// windows. Each window cleans up what it receives, so this only merges sections.
ipcMain.handle('settings:get', () => ({
  settings: state.settings ?? null,
  legacySearch: typeof state.search === 'string' ? state.search : '',
}))

ipcMain.on('settings:update', (_event, patch) => {
  if (!patch || typeof patch !== 'object') return
  const settings = { ...(state.settings ?? {}) }
  for (const [section, values] of Object.entries(patch)) {
    if (values && typeof values === 'object') {
      settings[section] = { ...(settings[section] ?? {}), ...values }
    }
  }
  saveState({ settings })
  broadcast('settings:changed', settings)
})

// Every finished arcade play is appended to a JSON Lines log, one object per line, with the
// claim code shown on the reward screen, so staff can verify a prize and export the results.
const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ23456789'
const CODE_LENGTH = 4

function readPlays() {
  try {
    return readFileSync(playsPath, 'utf8')
      .split('\n')
      .filter((line) => line.trim())
      .flatMap((line) => {
        try {
          return [JSON.parse(line)]
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}

let usedCodes

function newCode() {
  usedCodes ??= new Set(
    readPlays()
      .map((play) => play.id)
      .filter(Boolean),
  )
  for (;;) {
    let code = ''
    for (let index = 0; index < CODE_LENGTH; index += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    }
    if (!usedCodes.has(code)) {
      usedCodes.add(code)
      return code
    }
  }
}

ipcMain.handle('arcade:record', (_event, play) => {
  const text = (value, length) => String(value ?? '').slice(0, length)
  const entry = {
    id: newCode(),
    game: text(play?.game, 20),
    score: Number(play?.score) || 0,
    tier: text(play?.tier, 20),
    credits: Number(play?.credits) || 0,
    initials: play?.initials == null ? null : text(play.initials, 3),
    durationSeconds: Number(play?.durationSeconds) || 0,
    endedBy: text(play?.endedBy, 20),
    difficulty: text(play?.difficulty, 20),
    timeLimit: Number(play?.timeLimit) || 0,
    at: text(play?.at, 40) || new Date().toISOString(),
  }
  try {
    appendFileSync(playsPath, `${JSON.stringify(entry)}\n`)
  } catch {
    // The code still shows on screen even if the log can't be written.
  }
  broadcast('arcade:played', entry)
  return entry.id
})

ipcMain.handle('arcade:plays', () => readPlays().slice(-RECENT_PLAYS).reverse())

ipcMain.on('arcade:show-log', () => {
  shell.showItemInFolder(playsPath)
})

// Without a title bar, the background itself moves the TV window. Track the cursor from the
// main process so fast drags keep up even when the pointer leaves the window.
const drags = new Map()

function stopDrag(window) {
  clearInterval(drags.get(window)?.timer)
  drags.delete(window)
}

ipcMain.on('drag:start', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || window !== gameWindow || !window.isMovable() || window.isFullScreen()) return
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

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const boothItems = [
    { label: 'Show Admin Window', accelerator: 'CmdOrCtrl+,', click: () => showAdmin() },
    { label: 'Give Keypad to Game', accelerator: 'CmdOrCtrl+G', click: () => focusGame() },
  ]
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: 'appMenu' }] : []),
      { role: 'fileMenu' },
      { role: 'editMenu' },
      { label: 'Booth', submenu: boothItems },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]),
  )
}

app.whenReady().then(() => {
  // The booth display has to stay on all day.
  powerSaveBlocker.start('prevent-display-sleep')
  buildMenu()
  createGameWindow()
  createAdminWindow()
  app.on('activate', () => {
    if (!gameWindow) createGameWindow()
    else showAdmin()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
