import { describe, expect, it } from 'vitest'
import { sanitize } from './booth'
import {
  DEFAULT_FEEL,
  type JetpackFeel,
  curveAt,
  feelFrom,
  jetpackStep,
  rampAt,
  simulateFeel,
} from './flight'

describe('jetpack feel', (): void => {
  it('builds along each curve from 0 to 1', (): void => {
    for (const curve of ['linear', 'quadratic', 'exponential'] as const) {
      expect(curveAt(curve, 0)).toBe(0)
      expect(curveAt(curve, 1)).toBeCloseTo(1)
    }
    // Halfway through, linear is furthest along and exponential the least.
    expect(curveAt('linear', 0.5)).toBe(0.5)
    expect(curveAt('quadratic', 0.5)).toBe(0.25)
    expect(curveAt('exponential', 0.5)).toBeLessThan(0.25)
  })

  it('applies full force at once when the ramp is instant', (): void => {
    expect(rampAt(1, 0, 'exponential')).toBe(1)
    expect(rampAt(30, 30, 'quadratic')).toBe(1)
  })

  it('climbs higher with a stronger jetpack and stays lower with stronger gravity', (): void => {
    const peak = (feel: JetpackFeel): number => Math.max(...simulateFeel(feel, 60, 180))
    expect(peak({ ...DEFAULT_FEEL, thrust: 0.4 })).toBeGreaterThan(peak(DEFAULT_FEEL))
    expect(peak({ ...DEFAULT_FEEL, gravity: 0.2 })).toBeLessThan(peak(DEFAULT_FEEL))
  })

  it('climbs less in the first moments with a slower thrust curve', (): void => {
    const early = (feel: JetpackFeel): number => simulateFeel(feel, 60, 60)[15]!
    const ramped: JetpackFeel = { ...DEFAULT_FEEL, thrustRamp: 30 }
    expect(early({ ...ramped, thrustCurve: 'exponential' })).toBeLessThan(
      early({ ...ramped, thrustCurve: 'linear' }),
    )
  })

  it('never falls faster than the top fall speed', (): void => {
    const heights: number[] = simulateFeel({ ...DEFAULT_FEEL, gravity: 0.5, maxFall: 1.2 }, 0, 120)
    for (let tick: number = 1; tick < heights.length; tick += 1) {
      expect(heights[tick - 1]! - heights[tick]!).toBeLessThanOrEqual(1.2 + 1e-9)
    }
  })

  it('reads its settings from the admin window, in seconds', (): void => {
    const feel: JetpackFeel = feelFrom(
      sanitize({ jetpack: { thrustRamp: 0.5, fallCurve: 'exponential', thrustCurve: 'wobbly' } })
        .jetpack,
    )
    expect(feel.thrustRamp).toBe(30)
    expect(feel.fallCurve).toBe('exponential')
    // An unknown curve falls back to the default.
    expect(feel.thrustCurve).toBe('linear')
  })

  it('matches the Jetpack Joyride recording: up in about 0.97 s, down in about 1.08 s', (): void => {
    // Our flight area is about 130 pixels from floor to ceiling.
    const travel: number = 130
    const motion = { vy: 0, holdTicks: 0, releaseTicks: 0 }
    let height: number = 0
    let up: number = 0
    while (height < travel && up < 600) {
      jetpackStep(motion, true, DEFAULT_FEEL)
      height -= motion.vy
      up += 1
    }
    motion.vy = 0
    let down: number = 0
    while (height > 0 && down < 600) {
      jetpackStep(motion, false, DEFAULT_FEEL)
      height -= motion.vy
      down += 1
    }
    expect(up / 60).toBeGreaterThan(0.9)
    expect(up / 60).toBeLessThan(1.05)
    expect(down / 60).toBeGreaterThan(1)
    expect(down / 60).toBeLessThan(1.15)
  })
})
