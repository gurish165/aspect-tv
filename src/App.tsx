import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { ArcadeScreen } from './components/ArcadeScreen'
import { BouncingDisplay } from './components/BouncingDisplay'
import { displaySettings, pictureFilter, type BoothSettings } from './lib/booth'
import { useBoothSettings } from './lib/boothStore'
import type { DisplaySettings } from './lib/settings'

const IDLE_DELAY: number = 3500

/** Opens the admin window, or focuses it if it's already open. */
export function showAdmin(): void {
  if (window.aspectDesktop) {
    window.aspectDesktop.showAdmin()
    return
  }
  window.open(`${window.location.pathname}?admin`, 'aspect-tv-admin')
}

/**
 * The TV window: the bouncing logo with the arcade on top, and nothing else. Every control lives
 * in the admin window, so players only ever see the game.
 */
export function App(): ReactElement {
  const settings: BoothSettings = useBoothSettings()
  const display: DisplaySettings = useMemo(
    (): DisplaySettings => displaySettings(settings.display, settings.picture),
    [settings.display, settings.picture],
  )
  const [pointerVisible, setPointerVisible] = useState<boolean>(false)
  const idleTimer = useRef<number | undefined>(undefined)

  useEffect((): (() => void) => {
    // The pointer only shows while staff move the mouse over the TV.
    const revealPointer = (): void => {
      window.clearTimeout(idleTimer.current)
      setPointerVisible(true)
      idleTimer.current = window.setTimeout((): void => setPointerVisible(false), IDLE_DELAY)
    }
    // Laptop-keyboard shortcuts for staff. The keypad has none of these keys.
    const handleKeyboard = (event: KeyboardEvent): void => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      const key: string = event.key.toLowerCase()
      if (key === 's' || key === 'a') {
        event.preventDefault()
        showAdmin()
      } else if (key === 'f' && !window.aspectDesktop) {
        event.preventDefault()
        void (
          document.fullscreenElement
            ? document.exitFullscreen()
            : document.documentElement.requestFullscreen()
        ).catch((): void => undefined)
      }
    }
    window.addEventListener('pointermove', revealPointer)
    window.addEventListener('pointerdown', revealPointer)
    window.addEventListener('keydown', handleKeyboard)
    return (): void => {
      window.clearTimeout(idleTimer.current)
      window.removeEventListener('pointermove', revealPointer)
      window.removeEventListener('pointerdown', revealPointer)
      window.removeEventListener('keydown', handleKeyboard)
    }
  }, [])

  return (
    <main
      className="app"
      data-pointer-visible={pointerVisible}
      // Brightness, contrast, and color from the admin window's picture settings.
      style={{ filter: pictureFilter(settings.picture) }}
    >
      <BouncingDisplay
        settings={display}
        paused={settings.display.paused}
        showLogo={settings.display.mode === 'bounce'}
      >
        <ArcadeScreen />
      </BouncingDisplay>
    </main>
  )
}
