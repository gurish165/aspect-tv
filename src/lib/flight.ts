import { type Curve, type JetpackSection, JETPACK_FEEL } from './booth'

// How the jetpack feels: thrust and gravity, how fast each builds up, and along which curve.
// Shared by the game, its tests, and the admin window's preview chart.

const TICKS_PER_SECOND: number = 60

export interface JetpackFeel {
  thrust: number
  maxRise: number
  /** Ticks for thrust to build to full. */
  thrustRamp: number
  thrustCurve: Curve
  gravity: number
  maxFall: number
  /** Ticks for gravity to build to full after letting go. */
  fallRamp: number
  fallCurve: Curve
}

export function feelFrom(section: Pick<JetpackSection, keyof typeof JETPACK_FEEL>): JetpackFeel {
  return {
    thrust: section.thrust,
    maxRise: section.maxRise,
    thrustRamp: Math.round(section.thrustRamp * TICKS_PER_SECOND),
    thrustCurve: section.thrustCurve,
    gravity: section.gravity,
    maxFall: section.maxFall,
    fallRamp: Math.round(section.fallRamp * TICKS_PER_SECOND),
    fallCurve: section.fallCurve,
  }
}

export const DEFAULT_FEEL: JetpackFeel = feelFrom(JETPACK_FEEL)

const EXPONENT: number = 4

/** How far along a curve is at t, from 0 to 1. */
export function curveAt(curve: Curve, t: number): number {
  const clamped: number = Math.max(0, Math.min(1, t))
  switch (curve) {
    case 'linear':
      return clamped
    case 'quadratic':
      return clamped * clamped
    case 'exponential':
      return (Math.exp(EXPONENT * clamped) - 1) / (Math.exp(EXPONENT) - 1)
  }
}

/** How much of a force is on after some ticks of its ramp. A ramp of 0 is full force at once. */
export function rampAt(ticks: number, rampTicks: number, curve: Curve): number {
  if (rampTicks <= 0) return 1
  // The first tick always gets a little push, so a tap is never dead.
  return Math.max(0.05, curveAt(curve, ticks / rampTicks))
}

export interface JetpackMotion {
  vy: number
  /** Ticks the button has been held, or released, in a row. */
  holdTicks: number
  releaseTicks: number
}

/**
 * One tick of jetpack physics: velocity only, positive is down. Returns whether the jetpack is
 * firing. Gravity is always full while flying up; after letting go it builds along its own ramp.
 */
export function jetpackStep(motion: JetpackMotion, held: boolean, feel: JetpackFeel): boolean {
  if (held) {
    motion.holdTicks += 1
    motion.releaseTicks = 0
    motion.vy +=
      feel.gravity - feel.thrust * rampAt(motion.holdTicks, feel.thrustRamp, feel.thrustCurve)
  } else {
    motion.releaseTicks += 1
    motion.holdTicks = 0
    motion.vy += feel.gravity * rampAt(motion.releaseTicks, feel.fallRamp, feel.fallCurve)
  }
  motion.vy = Math.max(-feel.maxRise, Math.min(feel.maxFall, motion.vy))
  return held
}

/**
 * Height over time for one hold of the button and then letting go, starting at rest, for the
 * admin window's preview. Heights are in arcade pixels, up is positive.
 */
export function simulateFeel(feel: JetpackFeel, holdTicks: number, totalTicks: number): number[] {
  const motion: JetpackMotion = { vy: 0, holdTicks: 0, releaseTicks: 0 }
  let height: number = 0
  const heights: number[] = [0]
  for (let tick: number = 0; tick < totalTicks; tick += 1) {
    jetpackStep(motion, tick < holdTicks, feel)
    height -= motion.vy
    heights.push(height)
  }
  return heights
}
