import { useEffect, useRef, useState, type ReactElement } from 'react'
import { ROOMS, SUIT_SIZES, drawPlayer, drawRoom } from '../arcade/games/post'
import { text } from '../arcade/pixel'
import { getSettings } from '../lib/boothStore'
import { feelFrom, jetpackStep, type JetpackMotion } from '../lib/flight'

// A practice room for the jetpack: no obstacles, no crashing, just the current thrust and gravity
// settings. Hold the fly key (or the mouse button) over it to fly; the trail shows the last few
// seconds of flight, so the shape of each climb and fall is easy to compare as sliders move.

const WIDTH: number = 312
const HEIGHT: number = 130
const CEILING: number = 6
const FLOOR: number = HEIGHT - 12
const PLAYER_X: number = 70
const STEP: number = 1000 / 60
/** How far the trail scrolls left each tick, like the room going by. */
const TRAIL_SPEED: number = 1.2
const TRAIL_LENGTH: number = 150

export function FlightSandbox(): ReactElement {
  const canvas = useRef<HTMLCanvasElement>(null)
  const held = useRef<boolean>(false)
  const [active, setActive] = useState<boolean>(false)

  useEffect((): (() => void) | undefined => {
    const element: HTMLCanvasElement | null = canvas.current
    const context: CanvasRenderingContext2D | null | undefined = element?.getContext('2d')
    if (!element || !context) return
    context.imageSmoothingEnabled = false
    const playerHeight: number = SUIT_SIZES.jetpack.height
    const motion: JetpackMotion = { vy: 0, holdTicks: 0, releaseTicks: 0 }
    let y: number = FLOOR - playerHeight
    let ticks: number = 0
    let grounded: boolean = true
    const trail: { x: number; y: number; thrust: boolean }[] = []

    const isFlyKey = (event: KeyboardEvent): boolean =>
      getSettings().keys.fly.includes(event.code) || event.code === 'Space'
    const keydown = (event: KeyboardEvent): void => {
      if (!isFlyKey(event)) return
      event.preventDefault()
      held.current = true
    }
    const keyup = (event: KeyboardEvent): void => {
      if (!isFlyKey(event)) return
      event.preventDefault()
      held.current = false
    }
    const release = (): void => {
      held.current = false
    }
    element.addEventListener('keydown', keydown)
    element.addEventListener('keyup', keyup)
    element.addEventListener('blur', release)

    const step = (): void => {
      ticks += 1
      // Settings are read every tick, so a slider change shows up mid-flight.
      const thrusting: boolean = jetpackStep(motion, held.current, feelFrom(getSettings().jetpack))
      y += motion.vy
      grounded = false
      if (y + playerHeight >= FLOOR) {
        y = FLOOR - playerHeight
        motion.vy = 0
        grounded = true
      }
      if (y <= CEILING) {
        y = CEILING
        motion.vy = Math.max(0, motion.vy)
      }
      for (const point of trail) point.x -= TRAIL_SPEED
      trail.push({ x: PLAYER_X + 6, y: y + playerHeight / 2, thrust: thrusting })
      while (trail.length > TRAIL_LENGTH) trail.shift()

      drawRoom(context, ROOMS[0]!, WIDTH, 0, FLOOR, HEIGHT, ticks * TRAIL_SPEED, ticks)
      for (const point of trail) {
        context.fillStyle = point.thrust ? '#ffd21a' : '#9cc8ff'
        context.fillRect(Math.round(point.x), Math.round(point.y), 1, 1)
      }
      drawPlayer(context, {
        suit: 'jetpack',
        x: PLAYER_X,
        y,
        ticks,
        grounded,
        thrusting,
        upsideDown: false,
        crashed: false,
      })
      const speed: string = (-motion.vy).toFixed(2)
      text(context, `SPEED ${motion.vy <= 0 ? '+' : ''}${speed}`, 6, 4, '#ffffff')
      text(context, `HEIGHT ${Math.round(FLOOR - playerHeight - y)}`, WIDTH - 6, 4, '#ffffff', {
        align: 'right',
      })
    }

    let frame: number = 0
    let previous: number = performance.now()
    let backlog: number = 0
    const loop = (now: number): void => {
      backlog += Math.min(250, now - previous)
      previous = now
      while (backlog >= STEP) {
        step()
        backlog -= STEP
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return (): void => {
      cancelAnimationFrame(frame)
      element.removeEventListener('keydown', keydown)
      element.removeEventListener('keyup', keyup)
      element.removeEventListener('blur', release)
    }
  }, [])

  return (
    <figure className="flight-sandbox">
      <canvas
        ref={canvas}
        width={WIDTH}
        height={HEIGHT}
        tabIndex={0}
        aria-label="Test flight. Focus here, then hold the fly key or the mouse button to fly."
        onFocus={(): void => setActive(true)}
        onBlur={(): void => setActive(false)}
        onPointerDown={(event): void => {
          event.currentTarget.focus()
          event.currentTarget.setPointerCapture(event.pointerId)
          held.current = true
        }}
        onPointerUp={(): void => {
          held.current = false
        }}
        onPointerCancel={(): void => {
          held.current = false
        }}
        data-active={active}
      />
      <figcaption className="field-help">
        {active
          ? 'Hold 0, Space, or the mouse button to fly. The trail is gold while thrusting and blue while falling. Click outside to stop.'
          : 'Test flight: click here, then hold 0 (or Space, or the mouse button) to fly with the settings below. No obstacles, no crashing.'}
      </figcaption>
    </figure>
  )
}
