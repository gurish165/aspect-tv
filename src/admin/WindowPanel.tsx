import { useEffect, useState, type ReactElement } from 'react'
import { clearTodaysScores, todaysScoreCount } from '../arcade/scores'

/** The TV window's lock and fullscreen, and today's high-score board. */
export function WindowPanel(): ReactElement {
  const desktop: Window['aspectDesktop'] = window.aspectDesktop
  const [state, setState] = useState<WindowState | null>(null)
  const [scoreCount, setScoreCount] = useState<number>(todaysScoreCount)
  // Clearing scores takes two clicks so a stray click can't wipe the board.
  const [confirmingClear, setConfirmingClear] = useState<boolean>(false)

  useEffect((): (() => void) | undefined => {
    if (!desktop) return
    void desktop.getWindowState().then(setState)
    return desktop.onWindowState(setState)
  }, [desktop])

  useEffect((): (() => void) => {
    // High scores are saved by the TV window; storage events say when they change.
    const refresh = (): void => setScoreCount(todaysScoreCount())
    window.addEventListener('storage', refresh)
    const stopListening: (() => void) | undefined = desktop?.onPlay((): void => {
      window.setTimeout(refresh, 100)
    })
    return (): void => {
      window.removeEventListener('storage', refresh)
      stopListening?.()
    }
  }, [desktop])

  const clearScores = (): void => {
    if (!confirmingClear) {
      setConfirmingClear(true)
      return
    }
    clearTodaysScores()
    setScoreCount(todaysScoreCount())
    setConfirmingClear(false)
  }

  return (
    <section className="admin-card">
      <header>
        <div>
          <h2>TV window</h2>
          <p>
            {desktop
              ? 'Lock pins the TV window to its spot and size, including next launch. Unlock it to drag it by the background.'
              : 'Window controls are available in the desktop app.'}
          </p>
        </div>
      </header>
      {desktop && (
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            aria-pressed={state?.locked ?? false}
            onClick={(): void => {
              void desktop.setLocked(!state?.locked)
            }}
          >
            {state?.locked ? 'Unlock TV window' : 'Lock TV window'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={(): void => desktop.toggleFullscreen()}
          >
            {state?.fullscreen ? 'Exit fullscreen' : 'Make TV window fullscreen'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={(): void => desktop.focusGame()}
          >
            Give keypad to game
          </button>
        </div>
      )}
      <div className="settings-footer">
        <p>
          {scoreCount} high {scoreCount === 1 ? 'score' : 'scores'} on today&apos;s board. The board
          starts fresh each day.
        </p>
        <button
          type="button"
          className="quiet-button"
          onClick={clearScores}
          onBlur={(): void => setConfirmingClear(false)}
          disabled={scoreCount === 0}
        >
          {confirmingClear ? 'Click again to clear' : 'Clear high scores'}
        </button>
      </div>
    </section>
  )
}
