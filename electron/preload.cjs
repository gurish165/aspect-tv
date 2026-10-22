const { contextBridge, ipcRenderer } = require('electron')

const isAdmin = new URLSearchParams(window.location.search).has('admin')

function listen(channel, callback) {
  const handler = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('aspectDesktop', {
  remembersSettings: true,
  isLocked: () => ipcRenderer.invoke('lock:get'),
  setLocked: (locked) => ipcRenderer.invoke('lock:set', Boolean(locked)),
  getWindowState: () => ipcRenderer.invoke('window:get'),
  onWindowState: (callback) => listen('window:changed', callback),
  toggleFullscreen: () => ipcRenderer.send('window:fullscreen'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.send('settings:update', patch),
  onSettings: (callback) => listen('settings:changed', callback),
  getFocus: () => ipcRenderer.invoke('focus:get'),
  onFocus: (callback) => listen('focus:changed', callback),
  focusGame: () => ipcRenderer.send('focus:game'),
  showAdmin: () => ipcRenderer.send('admin:show'),
  recordPlay: (play) => ipcRenderer.invoke('arcade:record', play),
  recentPlays: () => ipcRenderer.invoke('arcade:plays'),
  onPlay: (callback) => listen('arcade:played', callback),
  showPlayLog: () => ipcRenderer.send('arcade:show-log'),
})

// The TV window has no title bar, so dragging its background moves it. The main process ignores
// drags while the window is locked. The admin window has a normal title bar.
if (!isAdmin) {
  const INTERACTIVE = 'button, input, label, select, textarea, a'
  let dragging = false

  window.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return
    if (event.target.closest(INTERACTIVE) || document.fullscreenElement) return
    dragging = true
    ipcRenderer.send('drag:start')
  })

  const endDrag = () => {
    if (!dragging) return
    dragging = false
    ipcRenderer.send('drag:end')
  }
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
  window.addEventListener('blur', endDrag)
}
