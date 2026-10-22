import { useEffect, useRef, type ReactElement } from 'react'
import { Arcade, TICKS_PER_SECOND } from '../arcade/arcade'
import { Sound } from '../arcade/audio'
import { ArcadeInput } from '../arcade/input'
import { BASE_HEIGHT, stage } from '../arcade/pixel'
import type { ScreenSection } from '../lib/booth'
import { getSettings, subscribeSettings } from '../lib/boothStore'

const STEP: number = 1000 / TICKS_PER_SECOND
/**
 * Every layout fits in this many arcade pixels across. When the size and stretch settings
 * together would make the arcade narrower, the size stops growing instead.
 */
export const MIN_COLUMNS: number = 200

/**
 * Fits the arcade canvas to its container. The size setting picks how many arcade pixels tall the
 * screen is, and the stretch setting makes each pixel wider or narrower than it is tall.
 */
function fit(canvas: HTMLCanvasElement, container: HTMLElement, screen: ScreenSection): void {
  const containerWidth: number = container.clientWidth
  const containerHeight: number = container.clientHeight
  if (containerWidth === 0 || containerHeight === 0) return
  const width: number = containerWidth * (1 - (2 * screen.marginX) / 100)
  const height: number = containerHeight * (1 - (2 * screen.marginY) / 100)
  let rows: number = Math.round((BASE_HEIGHT * 100) / screen.uiScale)
  let columns: number = Math.round(width / ((height / rows) * screen.stretch))
  if (columns < MIN_COLUMNS) {
    rows = Math.round((rows * MIN_COLUMNS) / columns)
    columns = MIN_COLUMNS
  }
  stage.width = columns
  stage.height = rows
  if (canvas.width !== columns || canvas.height !== rows) {
    // Resizing clears the canvas and its settings.
    canvas.width = columns
    canvas.height = rows
    const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
    if (context) context.imageSmoothingEnabled = false
  }
  canvas.style.left = `${(containerWidth - width) / 2 + (containerWidth * screen.shiftX) / 100}px`
  canvas.style.top = `${(containerHeight - height) / 2 + (containerHeight * screen.shiftY) / 100}px`
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
}

export function ArcadeScreen(): ReactElement {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect((): (() => void) | undefined => {
    const element: HTMLCanvasElement | null = canvas.current
    const container: HTMLElement | null | undefined = element?.parentElement
    const context: CanvasRenderingContext2D | null | undefined = element?.getContext('2d')
    if (!element || !container || !context) return
    const sound: Sound = new Sound(getSettings().arcade.volume)
    const input: ArcadeInput = new ArcadeInput()
    const arcade: Arcade = new Arcade(sound)
    input.attach(window)

    let screen: ScreenSection = getSettings().screen
    fit(element, container, screen)
    const observer: ResizeObserver = new ResizeObserver((): void => fit(element, container, screen))
    observer.observe(container)
    const unsubscribe: () => void = subscribeSettings((): void => {
      screen = getSettings().screen
      fit(element, container, screen)
      sound.volume = getSettings().arcade.volume
    })
    // When staff click into the admin window mid-game, the keypad stops reaching this window,
    // so pause rather than let the player lose.
    const suspend = (): void => arcade.suspend()
    window.addEventListener('blur', suspend)

    // Fixed 60 Hz game steps keep play identical on any display refresh rate.
    let previous: number = performance.now()
    let backlog: number = 0
    let frame: number = 0
    const loop = (now: number): void => {
      backlog += Math.min(250, now - previous)
      previous = now
      while (backlog >= STEP) {
        arcade.step(input.consume())
        backlog -= STEP
      }
      arcade.draw(context)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return (): void => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      unsubscribe()
      window.removeEventListener('blur', suspend)
      input.detach()
      sound.close()
    }
  }, [])

  return (
    <canvas
      ref={canvas}
      className="arcade-screen"
      aria-label="Aspect Arcade. Press Enter on the keypad to play."
    />
  )
}
