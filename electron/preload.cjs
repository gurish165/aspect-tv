const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('aspectDesktop', {
  remembersSettings: true,
  isLocked: () => ipcRenderer.invoke('lock:get'),
  setLocked: (locked) => ipcRenderer.invoke('lock:set', Boolean(locked)),
})

// The window has no title bar, so dragging the background moves it. Controls keep their clicks.
// The main process ignores drags while the window is locked.
const INTERACTIVE = 'button, input, label, select, textarea, a, .settings-panel, .control-bar'
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
