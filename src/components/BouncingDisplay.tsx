import { motion, useAnimationFrame, useMotionValue } from 'motion/react'
import { useLayoutEffect, useRef, type ReactElement } from 'react'
import { BounceSimulation } from '../lib/bounce'
import type { DisplaySettings } from '../lib/settings'
import { AspectLogo } from './AspectLogo'
import { CRTOverlay } from './CRTOverlay'

interface BouncingDisplayProps {
  settings: DisplaySettings
  paused: boolean
}

export function BouncingDisplay({ settings, paused }: BouncingDisplayProps): ReactElement {
  const container = useRef<HTMLDivElement>(null)
  const simulation = useRef<BounceSimulation>(new BounceSimulation())
  const horizontal = useMotionValue<number>(0)
  const vertical = useMotionValue<number>(0)
  const logoWidth = useMotionValue<number>(0)
  const logoHeight = useMotionValue<number>(0)
  const logoColor = useMotionValue<string>(simulation.current.color)

  useLayoutEffect((): (() => void) | undefined => {
    const element: HTMLDivElement | null = container.current
    if (!element) return

    const resize = (): void => {
      simulation.current.resize(element.clientWidth, element.clientHeight, settings)
      logoWidth.set(simulation.current.width)
      logoHeight.set(simulation.current.height)
      horizontal.set(simulation.current.left)
      vertical.set(simulation.current.top)
    }

    resize()
    const observer: ResizeObserver = new ResizeObserver(resize)
    observer.observe(element)
    return (): void => observer.disconnect()
  }, [settings.logoSize, settings.padding, horizontal, vertical, logoWidth, logoHeight])

  useAnimationFrame((_timestamp: number, delta: number): void => {
    if (paused || document.hidden) return
    simulation.current.advance(delta, settings.speed)
    horizontal.set(simulation.current.left)
    vertical.set(simulation.current.top)
    logoColor.set(simulation.current.color)
  })

  const glowRadius: number = 16 * settings.glow
  const colorOffset: number = settings.crt

  return (
    <div
      ref={container}
      className="bouncing-display"
      role="img"
      aria-label="Aspect logo bouncing across a CRT screen and changing color at each edge"
    >
      <motion.div
        className="bouncing-logo"
        style={{
          x: horizontal,
          y: vertical,
          width: logoWidth,
          height: logoHeight,
          color: logoColor,
        }}
      >
        <div
          className="logo-color-split"
          style={{
            opacity: settings.crt * 0.22,
            transform: `translateX(${-colorOffset}px)`,
            color: '#ff3b53',
          }}
        >
          <AspectLogo />
        </div>
        <div
          className="logo-color-split"
          style={{
            opacity: settings.crt * 0.22,
            transform: `translateX(${colorOffset}px)`,
            color: '#49aaff',
          }}
        >
          <AspectLogo />
        </div>
        <div
          className="logo-foreground"
          style={{
            filter: settings.glow > 0 ? `drop-shadow(0 0 ${glowRadius}px currentColor)` : undefined,
          }}
        >
          <AspectLogo />
        </div>
      </motion.div>
      <CRTOverlay settings={settings} paused={paused} />
    </div>
  )
}
