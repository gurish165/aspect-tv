import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react'
import { BouncingDisplay } from './components/BouncingDisplay'
import { Controls } from './components/Controls'
import { DisplaySettings, type SettingName } from './lib/settings'

const IDLE_DELAY: number = 3500

export function App(): ReactElement {
  const reducedMotion: boolean | null = useReducedMotion()
  const [settings, setSettings] = useState<DisplaySettings>(() =>
    DisplaySettings.fromSearch(window.location.search),
  )
  const [pauseOverride, setPauseOverride] = useState<boolean | null>(null)
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)
  const [controlsVisible, setControlsVisible] = useState<boolean>(true)
  const [fullscreen, setFullscreen] = useState<boolean>(Boolean(document.fullscreenElement))
  const [notice, setNotice] = useState<string>('')
  const idleTimer = useRef<number | undefined>(undefined)
  const paused: boolean = pauseOverride ?? Boolean(reducedMotion)

  const revealControls = useCallback((): void => {
    window.clearTimeout(idleTimer.current)
    setControlsVisible(true)
    if (settingsOpen) return
    idleTimer.current = window.setTimeout((): void => {
      const focused: Element | null = document.activeElement
      if (focused?.closest('[data-controls]') && focused.matches(':focus-visible')) return
      setControlsVisible(false)
    }, IDLE_DELAY)
  }, [settingsOpen])

  const togglePause = useCallback((): void => {
    setPauseOverride(!paused)
  }, [paused])

  const toggleSettings = useCallback((): void => {
    setSettingsOpen((previous: boolean): boolean => !previous)
  }, [])

  const toggleFullscreen = useCallback((): void => {
    setNotice('')
    if (!document.fullscreenEnabled) {
      setNotice('Use your browser’s fullscreen command on this device.')
      return
    }
    const request: Promise<void> = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen()
    void request.catch((): void => {
      setNotice(
        'Fullscreen was unavailable. Try the Fullscreen button or your browser’s fullscreen command.',
      )
    })
  }, [])

  useEffect((): void => {
    const search: string = settings.toSearch()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`,
    )
  }, [settings])

  useEffect((): (() => void) => {
    const synchronizeFullscreen = (): void => {
      setFullscreen(Boolean(document.fullscreenElement))
      revealControls()
    }
    const handleKeyboard = (event: KeyboardEvent): void => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === 'Escape') {
        setSettingsOpen(false)
        revealControls()
        return
      }
      const target: EventTarget | null = event.target
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return
      revealControls()
      if (event.code === 'Space') {
        if (target instanceof HTMLElement && target.closest('button, a')) return
        event.preventDefault()
        togglePause()
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        toggleFullscreen()
      } else if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        toggleSettings()
      }
    }

    revealControls()
    window.addEventListener('pointermove', revealControls)
    window.addEventListener('pointerdown', revealControls)
    window.addEventListener('keydown', handleKeyboard)
    document.addEventListener('fullscreenchange', synchronizeFullscreen)
    return (): void => {
      window.clearTimeout(idleTimer.current)
      window.removeEventListener('pointermove', revealControls)
      window.removeEventListener('pointerdown', revealControls)
      window.removeEventListener('keydown', handleKeyboard)
      document.removeEventListener('fullscreenchange', synchronizeFullscreen)
    }
  }, [revealControls, togglePause, toggleFullscreen, toggleSettings])

  const changeSetting = (property: SettingName, value: number): void => {
    setSettings((previous: DisplaySettings): DisplaySettings => previous.withValue(property, value))
  }

  const handleDoubleClick = (event: MouseEvent<HTMLElement>): void => {
    if (event.target instanceof Element && event.target.closest('[data-controls]')) return
    toggleFullscreen()
  }

  return (
    <main className="app" data-controls-visible={controlsVisible} onDoubleClick={handleDoubleClick}>
      <BouncingDisplay settings={settings} paused={paused} />
      <Controls
        settings={settings}
        settingsOpen={settingsOpen}
        visible={controlsVisible}
        paused={paused}
        fullscreen={fullscreen}
        notice={
          notice ||
          (reducedMotion && pauseOverride === null
            ? 'Animation is paused for your reduced-motion preference. Press Play to start.'
            : '')
        }
        onSettingChange={changeSetting}
        onSettingsToggle={toggleSettings}
        onPauseToggle={togglePause}
        onFullscreenToggle={toggleFullscreen}
        onReset={(): void => setSettings(new DisplaySettings())}
      />
    </main>
  )
}
