import { motion, useAnimationFrame, useMotionValue } from 'motion/react'
import { useRef, type CSSProperties, type ReactElement } from 'react'
import type { DisplaySettings } from '../lib/settings'

interface CRTOverlayProps {
  settings: DisplaySettings
  paused: boolean
}

interface CRTStyle extends CSSProperties {
  '--scan-spacing': string
  '--scan-dark': string
}

export function CRTOverlay({ settings, paused }: CRTOverlayProps): ReactElement {
  const elapsed = useRef<number>(0)
  const sweep = useMotionValue<string>('-100%')
  const overlayStyle: CRTStyle = {
    opacity: settings.crt / 2,
    '--scan-spacing': `${settings.scanSpacing}px`,
    '--scan-dark': `${settings.scanSpacing / 2}px`,
  }

  useAnimationFrame((_timestamp: number, delta: number): void => {
    if (paused || document.hidden || settings.crt === 0) return
    elapsed.current = (elapsed.current + Math.min(delta, 100)) % 4000
    sweep.set(`${-100 + (elapsed.current / 4000) * 500}%`)
  })

  return (
    <div className="crt-overlay" style={overlayStyle} aria-hidden="true">
      <div className="crt-scanlines" />
      <div className="crt-subpixels" />
      <motion.div className="crt-sweep" style={{ y: sweep }} />
      <div className="crt-vignette" />
    </div>
  )
}
