interface WindowState {
  locked: boolean
  fullscreen: boolean
  /** True when the admin window sits over the part of the screen the TV shows. */
  adminOverTv: boolean
}

interface Window {
  /** The Electron bridge from electron/preload.cjs. Missing in a plain browser. */
  aspectDesktop?: {
    remembersSettings: boolean
    isLocked: () => Promise<boolean>
    setLocked: (locked: boolean) => Promise<boolean>
    getWindowState: () => Promise<WindowState>
    onWindowState: (callback: (state: WindowState) => void) => () => void
    toggleFullscreen: () => void
    getSettings: () => Promise<{ settings: unknown; legacySearch: string }>
    updateSettings: (patch: import('./lib/booth').BoothPatch) => void
    onSettings: (callback: (settings: unknown) => void) => () => void
    /** Which window has keyboard focus, and so receives the keypad. */
    getFocus: () => Promise<{ game: boolean; admin: boolean }>
    onFocus: (callback: (focus: { game: boolean; admin: boolean }) => void) => () => void
    focusGame: () => void
    showAdmin: () => void
    /** Appends a finished play to this machine's play log and returns its claim code. */
    recordPlay: (play: import('./arcade/scores').PlayRecord) => Promise<string>
    recentPlays: () => Promise<import('./arcade/scores').LoggedPlay[]>
    onPlay: (callback: (play: import('./arcade/scores').LoggedPlay) => void) => () => void
    showPlayLog: () => void
  }
}
