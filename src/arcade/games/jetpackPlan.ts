import { type JetpackFeel, type JetpackMotion, jetpackStep } from '../../lib/flight'

// A route finder for Fix It In Post. Given the editor's height and speed and everything dangerous
// on screen, it searches every hold/let-go choice, tick by tick, with the real jetpack physics, and
// returns a sequence of button presses that survives, or null when none exists. The game uses it to
// make sure a new wire or laser burst never leaves the player without a way through; the tests use
// it to play long runs on their own.

export interface PlanWire {
  x: number
  y: number
  length: number
  angle: number
  spin: number
}

export interface PlanLaser {
  y: number
  delay: number
  age: number
}

export interface PlanNote {
  x: number
  y: number
  age: number
}

export interface PlanHazards {
  wires: readonly PlanWire[]
  lasers: readonly PlanLaser[]
  notes: readonly PlanNote[]
}

export interface PlanWorld {
  /** How far the room scrolls each tick. */
  speed: number
  floor: number
  ceiling: number
  playerX: number
  /** The jetpack's sprite height and its collision box [left, top, right, bottom]. */
  height: number
  box: readonly [number, number, number, number]
  laserWarn: number
  laserFire: number
  noteTrack: number
  noteLock: number
  noteSpeed: number
}

export interface PlanStart {
  y: number
  vy: number
  holdTicks: number
  releaseTicks: number
  /** Ticks the player can't be hit, right after losing a suit or coming back from a crash. */
  shield: number
}

/** Extra room around every hazard, so a route the planner finds is one a person can fly. */
const MARGIN: number = 2
/** The most states kept per tick; more than the coarse search ever produces without ramps. */
const BEAM: number = 8000

/** For one tick, which sprite heights (y of the sprite's top) would touch a hazard. */
function blockedAt(
  world: PlanWorld,
  hazards: PlanHazards,
  tick: number,
  margin: number = MARGIN,
): Uint8Array {
  const rows: Uint8Array = new Uint8Array(Math.ceil(world.floor) + 4)
  const [left, top, right, bottom] = world.box
  const boxLeft: number = world.playerX + left - margin
  const boxRight: number = world.playerX + right + margin
  const block = (from: number, to: number): void => {
    const start: number = Math.max(0, Math.floor(from))
    const end: number = Math.min(rows.length - 1, Math.ceil(to))
    for (let y: number = start; y <= end; y += 1) rows[y] = 1
  }
  for (const wire of hazards.wires) {
    const x: number = wire.x - world.speed * tick
    const angle: number = wire.angle + wire.spin * tick
    const half: number = wire.length / 2
    const dx: number = Math.cos(angle) * half
    const dy: number = Math.sin(angle) * half
    if (Math.max(x - dx, x + dx) < boxLeft || Math.min(x - dx, x + dx) > boxRight) continue
    const steps: number = Math.max(1, Math.ceil(wire.length))
    for (let step: number = 0; step <= steps; step += 1) {
      const t: number = step / steps
      const px: number = x - dx + 2 * dx * t
      if (px < boxLeft || px > boxRight) continue
      const py: number = wire.y - dy + 2 * dy * t
      // The box spans y + top to y + bottom; the point touches it for these sprite heights.
      block(py - bottom - margin, py - top + margin)
    }
  }
  for (const laser of hazards.lasers) {
    const age: number = laser.age + Math.max(0, tick - laser.delay)
    if (tick < laser.delay) continue
    if (age >= world.laserWarn && age < world.laserWarn + world.laserFire) {
      block(laser.y - 3 - bottom - margin, laser.y + 3 - top + margin)
    }
  }
  for (const note of hazards.notes) {
    // Only notes whose height is locked can be planned around; the rest still follow the player.
    if (note.age < world.noteTrack) continue
    // Ticks from now until it launches; note.x is where it is now, launched or not.
    const launchIn: number = Math.max(0, world.noteTrack + world.noteLock - note.age)
    const flying: number = tick - launchIn
    if (flying < 0) continue
    const x: number = note.x - world.noteSpeed * flying
    if (x > boxRight || x + 13 < boxLeft) continue
    block(note.y - 4 - bottom - margin, note.y + 4 - top + margin)
  }
  return rows
}

// Search buffers, reused between calls so a check allocates almost nothing while the game runs.
let stamps: Int32Array = new Int32Array(0)
let generation: number = 0

/** Fixed-size columns for one tick of the search: each state's motion and how it got there. */
interface Layer {
  size: number
  y: Float32Array
  vy: Float32Array
  hold: Int16Array
  release: Int16Array
  parent: Int32Array
  held: Uint8Array
}

function layer(capacity: number): Layer {
  return {
    size: 0,
    y: new Float32Array(capacity),
    vy: new Float32Array(capacity),
    hold: new Int16Array(capacity),
    release: new Int16Array(capacity),
    parent: new Int32Array(capacity),
    held: new Uint8Array(capacity),
  }
}

/** Ramp counters fold into eight steps, enough to tell early, middle, and full thrust apart. */
function bucket(ticks: number, ramp: number): number {
  return ramp <= 0 ? 0 : Math.min(7, Math.floor((Math.min(ticks, ramp) * 8) / (ramp + 1)))
}

export interface RouteOptions {
  /** Pixels of clearance to keep from every hazard. */
  margin?: number
  /** The most states kept per tick. */
  beam?: number
  /**
   * Count states as the same within half a pixel and 0.05 of speed. The default groups them by
   * 2 pixels and 0.2, which is quick enough to run while the game plays and only ever errs toward
   * saying no.
   */
  fine?: boolean
}

/**
 * Finds button presses (true = hold) that keep the jetpack clear of every hazard for the given
 * number of ticks, or null when none can be found. Every route it returns is a real one, flown
 * with the real physics; states it treats as the same only ever cost it a route, never invent one.
 */
export function findRoute(
  world: PlanWorld,
  hazards: PlanHazards,
  start: PlanStart,
  feel: JetpackFeel,
  horizon: number,
  options: RouteOptions = {},
): boolean[] | null {
  const margin: number = options.margin ?? MARGIN
  const beam: number = options.beam ?? BEAM
  const yScale: number = options.fine ? 2 : 0.5
  const vyScale: number = options.fine ? 20 : 5
  const vyOffset: number = Math.ceil(feel.maxRise * vyScale) + 2
  const vyBins: number = vyOffset + Math.ceil(feel.maxFall * vyScale) + 3
  const yBins: number = Math.ceil((world.floor + 4) * yScale) + 1
  const keys: number = yBins * vyBins * 64
  if (stamps.length < keys) stamps = new Int32Array(keys)

  const layers: Layer[] = []
  const first: Layer = layer(1)
  first.size = 1
  first.y[0] = start.y
  first.vy[0] = start.vy
  first.hold[0] = start.holdTicks
  first.release[0] = start.releaseTicks
  first.parent[0] = -1
  layers.push(first)
  const motion: JetpackMotion = { vy: 0, holdTicks: 0, releaseTicks: 0 }
  const floorY: number = world.floor - world.height

  for (let tick: number = 1; tick <= horizon; tick += 1) {
    const blocked: Uint8Array = blockedAt(world, hazards, tick, margin)
    const previous: Layer = layers[tick - 1]!
    const next: Layer = layer(previous.size * 2)
    generation += 1
    if (generation > 2_000_000_000) {
      stamps.fill(0)
      generation = 1
    }
    for (let index: number = 0; index < previous.size; index += 1) {
      for (let choice: number = 0; choice < 2; choice += 1) {
        const held: boolean = choice === 0
        motion.vy = previous.vy[index]!
        motion.holdTicks = previous.hold[index]!
        motion.releaseTicks = previous.release[index]!
        jetpackStep(motion, held, feel)
        let y: number = previous.y[index]! + motion.vy
        let vy: number = motion.vy
        if (y >= floorY) {
          y = floorY
          vy = 0
        }
        if (y <= world.ceiling) {
          y = world.ceiling
          vy = Math.max(0, vy)
        }
        if (tick > start.shield && blocked[Math.round(y)]) continue
        const key: number =
          ((Math.round(y * yScale) * vyBins + Math.round(vy * vyScale) + vyOffset) * 8 +
            bucket(motion.holdTicks, feel.thrustRamp)) *
            8 +
          bucket(motion.releaseTicks, feel.fallRamp)
        if (stamps[key] === generation) continue
        stamps[key] = generation
        const slot: number = next.size
        next.y[slot] = y
        next.vy[slot] = vy
        next.hold[slot] = Math.min(motion.holdTicks, 32000)
        next.release[slot] = Math.min(motion.releaseTicks, 32000)
        next.parent[slot] = index
        next.held[slot] = held ? 1 : 0
        next.size += 1
      }
    }
    if (next.size === 0) return null
    layers.push(next.size > beam ? thin(next, beam) : next)
  }
  // Walk back from any survivor to recover the presses.
  const route: boolean[] = []
  let index: number = 0
  for (let tick: number = horizon; tick > 0; tick -= 1) {
    const current: Layer = layers[tick]!
    route.push(current.held[index] === 1)
    index = current.parent[index]!
  }
  return route.reverse()
}

/** Keeps an even spread of states across heights and speeds when there are too many to search. */
function thin(full: Layer, beam: number): Layer {
  const order: number[] = Array.from({ length: full.size }, (_, index: number): number => index)
  order.sort((a: number, b: number): number => full.y[a]! - full.y[b]! || full.vy[a]! - full.vy[b]!)
  const kept: Layer = layer(beam)
  const stride: number = full.size / beam
  for (let slot: number = 0; slot < beam; slot += 1) {
    const from: number = order[Math.floor(slot * stride)]!
    kept.y[slot] = full.y[from]!
    kept.vy[slot] = full.vy[from]!
    kept.hold[slot] = full.hold[from]!
    kept.release[slot] = full.release[from]!
    kept.parent[slot] = full.parent[from]!
    kept.held[slot] = full.held[from]!
  }
  kept.size = beam
  return kept
}

/** Ticks until everything dangerous now in play is past the player, so a route must last that long. */
export function clearHorizon(world: PlanWorld, hazards: PlanHazards, limit: number = 420): number {
  let ticks: number = 1
  const passed: number = world.playerX - 8
  for (const wire of hazards.wires) {
    ticks = Math.max(ticks, Math.ceil((wire.x + wire.length / 2 - passed) / world.speed))
  }
  for (const laser of hazards.lasers) {
    ticks = Math.max(ticks, laser.delay + world.laserWarn + world.laserFire - laser.age)
  }
  for (const note of hazards.notes) {
    const launch: number = Math.max(0, world.noteTrack + world.noteLock - note.age)
    ticks = Math.max(ticks, launch + Math.ceil((note.x - passed + 13) / world.noteSpeed))
  }
  return Math.min(limit, Math.max(1, ticks))
}

/** Ticks from now until a missile reaches the player, launched or not. */
export function noteArrival(world: PlanWorld, note: PlanNote): number {
  const launchIn: number = Math.max(0, world.noteTrack + world.noteLock - note.age)
  return launchIn + Math.max(0, (note.x - (world.playerX + world.box[2])) / world.noteSpeed)
}

/** The ticks from now during which any of these wires overlaps the player's column, or null. */
export function wireWindow(world: PlanWorld, wires: readonly PlanWire[]): [number, number] | null {
  let first: number = Number.POSITIVE_INFINITY
  let last: number = Number.NEGATIVE_INFINITY
  const left: number = world.playerX + world.box[0] - 6
  const right: number = world.playerX + world.box[2] + 6
  for (const wire of wires) {
    const half: number =
      wire.spin !== 0 ? wire.length / 2 : (Math.abs(Math.cos(wire.angle)) * wire.length) / 2
    const enter: number = (wire.x - half - right) / world.speed
    const leave: number = (wire.x + half - left) / world.speed
    if (leave < 0) continue
    first = Math.min(first, Math.max(0, enter))
    last = Math.max(last, leave)
  }
  return Number.isFinite(first) ? [first, last] : null
}
