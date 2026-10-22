import type { JetpackSection } from '../../lib/booth'
import { getSettings } from '../../lib/boothStore'
import { DEFAULT_FEEL, type JetpackFeel, feelFrom, jetpackStep } from '../../lib/flight'
import type { Sound } from '../audio'
import { type InputFrame, actionKey } from '../input'
import {
  GOLD,
  INK,
  MUTED,
  clockColor,
  glyphRows,
  pad,
  rect,
  stage,
  text,
  textWidth,
} from '../pixel'
import {
  ROOMS,
  SLOT_SYMBOLS,
  SUITS,
  SUIT_NAMES,
  SUIT_SIZES,
  type Room,
  type SlotSymbol,
  type Suit,
  drawKeyframe,
  drawLaser,
  drawMissile,
  drawMissileWarning,
  drawPlayer,
  drawRoom,
  drawRoomSign,
  drawSlotSymbol,
  drawSuitBox,
  drawToken,
  drawWire,
} from './post'
import {
  type PlanHazards,
  type PlanStart,
  type PlanWorld,
  clearHorizon,
  findRoute,
  noteArrival,
  wireWindow,
} from './jetpackPlan'
import type { Game, GameDefinition, Hud } from './types'

// Fix It In Post: a Jetpack Joyride-style flyer through a post-production house. Hold to fly,
// let go to drift down. Dodge live wires, projector beams, and missiles; collect
// keyframes; grab ? boxes for suits that each absorb a hit; and save play tokens for the slot
// machine that comes up after a crash.

const HUD_HEIGHT: number = 11
const FLOOR_DEPTH: number = 14
const PLAYER_X: number = 40
/** World pixels per meter, for the distance score. */
const PIXELS_PER_METER: number = 6
/** Each room lasts this long before the run moves into the next one. */
const ROOM_TICKS: number = 900
const SIGN_TICKS: number = 100
const MAX_TOKENS: number = 3
const KEYFRAME_SPACING: number = 7
const WORDS: readonly string[] = ['ASPECT', 'POST', 'EDIT', 'FIX', 'RENDER']
const LASER_WARN: number = 75
const LASER_FIRE: number = 60
const NOTE_TRACK: number = 70
const NOTE_LOCK: number = 25
const CRASH_TICKS: number = 70
/** Ticks of open air kept on either side of a missile's arrival, free of wires. */
const MISSILE_CLEARANCE: number = 30
const SHIELD_TICKS: number = 100
/** How long putting on a suit takes: the editor flickers into it while its name fills the screen. */
const SUIT_TICKS: number = 150
const REVIVE_SHIELD: number = 150
/** Ticks before an idle slot machine pulls itself, so the line keeps moving. */
const SLOT_AUTO_PULL: number = 240
const SLOT_STOPS: readonly number[] = [30, 48, 66]
const SLOT_RESULT: number = 80
const BONUS_KEYFRAMES: number = 250

type Phase = 'running' | 'suiting' | 'crashing' | 'slot' | 'done'
export type Prize = SlotSymbol | 'none'

interface Keyframe {
  x: number
  y: number
  seed: number
}

interface Wire {
  x: number
  y: number
  length: number
  angle: number
  spin: number
  seed: number
}

interface Laser {
  y: number
  /** Ticks until it starts warming up. */
  delay: number
  age: number
}

/** What the route finder (and the playthrough tests) can see of a run. */
export interface PlanView {
  world: PlanWorld
  hazards: PlanHazards
  start: PlanStart
  feel: JetpackFeel
  suit: Suit
  running: boolean
  meters: number
  crashes: number
}

/** New hazards waiting on a route check before they spawn. */
interface Hazards {
  wires: Wire[]
  lasers: Laser[]
}

interface Note {
  x: number
  y: number
  age: number
}

interface Spark {
  x: number
  y: number
  dx: number
  dy: number
  age: number
  color: string
}

interface Popup {
  x: number
  y: number
  label: string
  color: string
  age: number
}

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

const PRIZE_WEIGHTS: Record<SlotSymbol, number> = { take2: 30, suit: 20, bonus: 35, spins: 15 }

function prizeLabel(prize: Prize, suit: Suit): string {
  switch (prize) {
    case 'take2':
      return 'TAKE 2!'
    case 'suit':
      return `SUIT UP! ${SUIT_NAMES[suit]}`
    case 'bonus':
      return `+${BONUS_KEYFRAMES} KEYFRAMES`
    case 'spins':
      return '+3 SPINS'
    case 'none':
      return 'NO MATCH'
  }
}

function wireEnds(wire: Wire): [number, number, number, number] {
  const dx: number = (Math.cos(wire.angle) * wire.length) / 2
  const dy: number = (Math.sin(wire.angle) * wire.length) / 2
  return [wire.x - dx, wire.y - dy, wire.x + dx, wire.y + dy]
}

/** True when any point along the segment falls inside the box, grown by a little padding. */
function segmentHits(
  box: Box,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  padding: number,
): boolean {
  const steps: number = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 2))
  for (let step: number = 0; step <= steps; step += 1) {
    const x: number = x1 + ((x2 - x1) * step) / steps
    const y: number = y1 + ((y2 - y1) * step) / steps
    if (
      x >= box.left - padding &&
      x <= box.right + padding &&
      y >= box.top - padding &&
      y <= box.bottom + padding
    ) {
      return true
    }
  }
  return false
}

/**
 * How many times a missile warning has flashed by a given age. The flash rate climbs steadily
 * from about four a second to fifteen, so the ! flashes faster and faster until the missile fires.
 */
function warningFlashes(age: number): number {
  const total: number = NOTE_TRACK + NOTE_LOCK
  const start: number = 1 / 16
  const end: number = 1 / 2
  const t: number = Math.min(age, total)
  return start * t + ((end - start) * t * t) / (2 * total)
}

/** Whether a missile warning is lit at a given age. */
function warningLit(age: number): boolean {
  return Math.floor(warningFlashes(age)) % 2 === 0
}

/** Whether a missile's arrival falls within, or close to, the time wires pass the player. */
function overlaps(window: [number, number] | null, arrival: number): boolean {
  if (!window) return false
  return arrival > window[0] - MISSILE_CLEARANCE && arrival < window[1] + MISSILE_CLEARANCE
}

function pick<Item>(items: readonly Item[]): Item {
  return items[Math.floor(Math.random() * items.length)] ?? items[0]!
}

/** The player's motion, kept apart from the game so the physics can be tested on their own. */
export interface Flight {
  y: number
  vy: number
  grounded: boolean
  /** Gravity for the Flip Suit: 1 pulls to the floor, -1 to the ceiling. */
  gravity: 1 | -1
  thrusting: boolean
  /** Ticks the fly button has been held, or released, in a row, for the jetpack's ramps. */
  holdTicks: number
  releaseTicks: number
}

export type FlightEvent = 'jump' | 'cut' | 'flip' | null

/**
 * One tick of flight for a suit on the single fly button. Updates the flight in place and returns
 * what happened, for sounds and sparks. The marker is where a Jump Cut would land.
 */
export function flightStep(
  flight: Flight,
  suit: Suit,
  held: boolean,
  pressed: boolean,
  floor: number,
  ceiling: number,
  marker: number,
  feel: JetpackFeel = DEFAULT_FEEL,
): FlightEvent {
  const height: number = SUIT_SIZES[suit].height
  let event: FlightEvent = null
  flight.thrusting = false
  switch (suit) {
    case 'jetpack': {
      // Hold to thrust up; let go and drift down. The feel is tuned in the admin window.
      flight.thrusting = jetpackStep(flight, held, feel)
      break
    }
    case 'rig': {
      // Tap to jump, hold to hover down on the hand thrusters.
      // A tap clears about 90 pixels, most of the room; it comes down slower than the jetpack.
      if (pressed && flight.grounded) {
        flight.vy = -5.7
        event = 'jump'
      }
      flight.vy = Math.min(2.4, flight.vy + 0.18)
      if (!flight.grounded && held && flight.vy > 0.5) {
        flight.vy = 0.5
        flight.thrusting = true
      }
      break
    }
    case 'dragon': {
      // Inverted, like Mr. Cuddles: let go to rise, hold to dive and breathe fire.
      flight.vy = Math.max(-2.2, Math.min(2.4, flight.vy + (held ? 0.28 : -0.24)))
      flight.thrusting = held
      break
    }
    case 'hog': {
      // Tap to jump, hold for a higher jump. The guns fire on their own.
      // A tap hops about 30 pixels; holding stretches it to about 73.
      if (pressed && flight.grounded) {
        flight.vy = -4.2
        event = 'jump'
      }
      flight.vy += held && flight.vy < 0 ? 0.12 : 0.3
      break
    }
    case 'jumpCut': {
      // A marker sweeps up and down; press to cut straight to it.
      if (pressed) {
        flight.y = marker
        event = 'cut'
      }
      flight.vy = 0
      flight.grounded = false
      return event
    }
    case 'flip': {
      // Each press flips gravity between the floor and the ceiling.
      if (pressed) {
        flight.gravity = flight.gravity === 1 ? -1 : 1
        flight.grounded = false
        event = 'flip'
      }
      flight.vy = Math.max(-4, Math.min(4, flight.vy + 0.4 * flight.gravity))
      break
    }
  }
  flight.y += flight.vy
  flight.grounded = false
  if (flight.y + height >= floor) {
    flight.y = floor - height
    flight.vy = 0
    flight.grounded = suit !== 'flip' || flight.gravity === 1
  }
  if (flight.y <= ceiling) {
    flight.y = ceiling
    flight.vy = Math.max(0, flight.vy)
    if (suit === 'flip' && flight.gravity === -1) {
      flight.vy = 0
      flight.grounded = true
    }
  }
  return event
}

/**
 * One pull of the slot machine. A win lines up three of a kind, picked by prize weight; a loss
 * never does.
 */
export function rollSlot(
  winChance: number,
  random: () => number,
): { reels: SlotSymbol[]; prize: Prize } {
  const choose = (symbols: readonly SlotSymbol[]): SlotSymbol =>
    symbols[Math.floor(random() * symbols.length)] ?? symbols[0]!
  if (random() * 100 < winChance) {
    const total: number = SLOT_SYMBOLS.reduce(
      (sum: number, symbol: SlotSymbol): number => sum + PRIZE_WEIGHTS[symbol],
      0,
    )
    let roll: number = random() * total
    let prize: SlotSymbol = 'bonus'
    for (const symbol of SLOT_SYMBOLS) {
      roll -= PRIZE_WEIGHTS[symbol]
      if (roll < 0) {
        prize = symbol
        break
      }
    }
    return { reels: [prize, prize, prize], prize }
  }
  const first: SlotSymbol = choose(SLOT_SYMBOLS)
  const second: SlotSymbol = choose(SLOT_SYMBOLS)
  const third: SlotSymbol =
    first === second
      ? choose(SLOT_SYMBOLS.filter((symbol: SlotSymbol): boolean => symbol !== first))
      : choose(SLOT_SYMBOLS)
  return { reels: [first, second, third], prize: 'none' }
}

class JetpackGame implements Game {
  over: boolean = false
  #sound: Sound
  #best: number
  #phase: Phase = 'running'
  #ticks: number = 0
  #runTicks: number = 0
  #distance: number = 0
  #speed: number
  #keyframes: number = 0
  #tokens: number = 0
  #tokensSpawned: number = 0
  #suitsWorn: number = 0
  #suit: Suit = 'jetpack'
  #y: number
  #vy: number = 0
  #grounded: boolean = true
  #thrusting: boolean = false
  #holdTicks: number = 0
  #releaseTicks: number = 0
  /** Gravity for the Flip Suit: 1 pulls to the floor, -1 to the ceiling. */
  #gravity: 1 | -1 = 1
  #shield: number = 0
  #crashFor: number = 0
  /** Times the plain jetpack was hit, for the playthrough tests. */
  #crashes: number = 0
  #suitingFor: number = 0
  #pendingSuit: Suit = 'rig'
  #doneFor: number = 0
  #untilNext: number = 220
  #untilSuit: number
  #untilToken: number
  #keyframeList: Keyframe[] = []
  #wires: Wire[] = []
  #lasers: Laser[] = []
  #notes: Note[] = []
  #token: { x: number; y: number; age: number } | null = null
  #suitBox: { x: number; y: number; age: number } | null = null
  #bullets: { x: number; y: number }[] = []
  #sparks: Spark[] = []
  #popups: Popup[] = []
  #lastCoinSound: number = 0
  #slot: {
    reels: SlotSymbol[]
    prize: Prize
    /** Ticks since the lever was pulled, or -1 while waiting for a pull. */
    age: number
    idle: number
    suit: Suit
  } = { reels: ['take2', 'bonus', 'spins'], prize: 'none', age: -1, idle: 0, suit: 'rig' }

  constructor(sound: Sound, best: number) {
    this.#sound = sound
    this.#best = best
    const settings: JetpackSection = getSettings().jetpack
    this.#speed = settings.startSpeed
    this.#untilSuit = settings.suitEvery * 60
    this.#untilToken = settings.tokenEvery * 60
    this.#y = this.#floor - SUIT_SIZES.jetpack.height
  }

  get score(): number {
    return Math.floor(this.#distance / PIXELS_PER_METER) + this.#keyframes
  }

  get summary(): string {
    const parts: string[] = [
      `${Math.floor(this.#distance / PIXELS_PER_METER)}M`,
      `${this.#keyframes} KEYFRAMES`,
    ]
    if (this.#suitsWorn > 0) parts.push(`${this.#suitsWorn} SUIT${this.#suitsWorn > 1 ? 'S' : ''}`)
    while (parts.length > 1 && textWidth(parts.join(' · ')) > stage.width - 8) parts.pop()
    return parts.join(' · ')
  }

  endTitle(endedBy: 'game over' | 'time'): string {
    return endedBy === 'time' ? 'PICTURE LOCK!' : 'RENDER FAILED'
  }

  get #floor(): number {
    return stage.height - FLOOR_DEPTH
  }

  /** The top and bottom of the space the player can fly in. */
  get #ceiling(): number {
    return HUD_HEIGHT + 5
  }

  get #room(): Room {
    return ROOMS[Math.floor(this.#runTicks / ROOM_TICKS) % ROOMS.length] ?? ROOMS[0]!
  }

  #ramp(settings: JetpackSection): number {
    return Math.min(1, this.#runTicks / (settings.rampSeconds * 60))
  }

  #playerBox(): Box {
    const [left, top, right, bottom] = SUIT_SIZES[this.#suit].box
    return {
      left: PLAYER_X + left,
      top: this.#y + top,
      right: PLAYER_X + right,
      bottom: this.#y + bottom,
    }
  }

  #burst(x: number, y: number, colors: readonly string[], count: number): void {
    for (let index: number = 0; index < count; index += 1) {
      const angle: number = (index / count) * Math.PI * 2 + Math.random() * 0.5
      const speed: number = 0.6 + Math.random() * 1.6
      this.#sparks.push({
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        age: 0,
        color: colors[index % colors.length] ?? INK,
      })
    }
  }

  #popup(x: number, y: number, label: string, color: string = GOLD): void {
    this.#popups.push({ x, y, label, color, age: 0 })
  }

  update(input: InputFrame): void {
    this.#ticks += 1
    for (const spark of this.#sparks) {
      spark.x += spark.dx
      spark.y += spark.dy
      spark.dy += 0.05
      spark.age += 1
    }
    this.#sparks = this.#sparks.filter((spark: Spark): boolean => spark.age < 28)
    this.#popups = this.#popups.filter((popup: Popup): boolean => (popup.age += 1) < 50)
    if (this.over) return
    const settings: JetpackSection = getSettings().jetpack

    switch (this.#phase) {
      case 'running':
        this.#run(input, settings)
        break
      case 'suiting':
        this.#suiting(settings)
        break
      case 'crashing':
        this.#crashing()
        break
      case 'slot':
        this.#slotStep(input, settings)
        break
      case 'done':
        this.#doneFor += 1
        if (this.#doneFor > 40) this.over = true
        break
    }
  }

  #run(input: InputFrame, settings: JetpackSection): void {
    this.#runTicks += 1
    if (this.#runTicks % ROOM_TICKS === 0) this.#sound.play('count')
    // Difficulty comes from the admin window and applies live.
    const ramp: number = this.#ramp(settings)
    this.#speed = settings.startSpeed + (settings.topSpeed - settings.startSpeed) * ramp
    this.#distance += this.#speed
    if (this.#shield > 0) this.#shield -= 1

    this.#fly(input)
    this.#scroll()
    this.#spawn(settings, ramp)
    this.#collect()
    if (this.#suit === 'hog') this.#hogGuns()
    this.#hazards()
  }

  /** How each suit flies; the physics live in flightStep so they can be tested on their own. */
  #fly(input: InputFrame): void {
    const flight: Flight = {
      y: this.#y,
      vy: this.#vy,
      grounded: this.#grounded,
      gravity: this.#gravity,
      thrusting: false,
      holdTicks: this.#holdTicks,
      releaseTicks: this.#releaseTicks,
    }
    const before: number = this.#y
    const event: FlightEvent = flightStep(
      flight,
      this.#suit,
      input.held.has('fly'),
      input.pressed('fly'),
      this.#floor,
      this.#ceiling,
      this.#cutMarker(),
      feelFrom(getSettings().jetpack),
    )
    this.#holdTicks = flight.holdTicks
    this.#releaseTicks = flight.releaseTicks
    this.#y = flight.y
    this.#vy = flight.vy
    this.#grounded = flight.grounded
    this.#gravity = flight.gravity
    this.#thrusting = flight.thrusting
    if (event === 'cut') {
      this.#burst(PLAYER_X + 6, before + 9, ['#ff4fd8', '#ffffff'], 10)
      this.#burst(PLAYER_X + 6, this.#y + 9, ['#ff4fd8', '#ffffff'], 10)
      this.#sound.play('letter')
    } else if (event) {
      this.#sound.play('jump')
    }
  }

  /** Where the Jump Cut marker is right now. */
  #cutMarker(): number {
    const top: number = this.#ceiling
    const bottom: number = this.#floor - SUIT_SIZES.jumpCut.height
    return Math.round(top + ((Math.sin(this.#runTicks / 28) + 1) / 2) * (bottom - top))
  }

  #scroll(): void {
    const speed: number = this.#speed
    for (const keyframe of this.#keyframeList) keyframe.x -= speed
    for (const wire of this.#wires) {
      wire.x -= speed
      wire.angle += wire.spin
    }
    for (const bullet of this.#bullets) bullet.x += 5
    if (this.#token) {
      // Tokens fly forward on their own, so they drift past slower than the room.
      this.#token.x -= speed * 0.6
      this.#token.age += 1
    }
    if (this.#suitBox) {
      this.#suitBox.x -= speed
      this.#suitBox.age += 1
    }
    this.#keyframeList = this.#keyframeList.filter(
      (keyframe: Keyframe): boolean => keyframe.x > -10,
    )
    this.#wires = this.#wires.filter((wire: Wire): boolean => wire.x + wire.length / 2 > -10)
    this.#bullets = this.#bullets.filter((bullet): boolean => bullet.x < stage.width + 10)
    if (this.#token && this.#token.x < -12) this.#token = null
    if (this.#suitBox && this.#suitBox.x < -12) this.#suitBox = null
  }

  #spawn(settings: JetpackSection, ramp: number): void {
    const width: number = stage.width
    const top: number = this.#ceiling + 6
    const bottom: number = this.#floor - 6

    // Play tokens float in on their own schedule, up to three per run.
    this.#untilToken -= 1
    if (this.#untilToken <= 0 && !this.#token && this.#tokensSpawned < MAX_TOKENS) {
      this.#token = { x: width + 12, y: top + (bottom - top) * (0.3 + Math.random() * 0.4), age: 0 }
      this.#tokensSpawned += 1
      this.#untilToken = settings.tokenEvery * 60
    }
    // Suit boxes only come along while flying the plain jetpack.
    this.#untilSuit -= 1
    if (this.#untilSuit <= 0 && !this.#suitBox && this.#suit === 'jetpack') {
      this.#suitBox = {
        x: width + 12,
        y: top + (bottom - top) * (0.25 + Math.random() * 0.5),
        age: 0,
      }
      this.#untilSuit = settings.suitEvery * 60
    }

    // Nothing else spawns while a laser burst is on.
    if (this.#lasers.length > 0) return
    this.#untilNext -= this.#speed
    if (this.#untilNext > 0) return
    const gap: number = ((70 + Math.random() * 90) * settings.spacing + this.#speed * 10) | 0
    const roll: number = Math.random() * 100
    if (this.#suit === 'jetpack' && ramp > 0.15 && roll < settings.laserChance) {
      const burst: Laser[] | null =
        this.#safely((): Hazards => {
          const lasers: Laser[] = []
          this.#startLasers(ramp, lasers)
          return { wires: [], lasers }
          // Laser checks take longer, so a burst gets fewer tries.
        }, 3)?.lasers ?? null
      if (burst) {
        this.#lasers.push(...burst)
        this.#sound.play('count')
        this.#untilNext = 50
      } else {
        this.#untilNext = this.#spawnKeyframes(top, bottom) + gap
      }
    } else if (ramp > 0.08 && roll < settings.laserChance + settings.missileChance) {
      // A missile locks onto the player's height, so it must arrive in open air, never while
      // the player is threading wires and has nowhere to dodge.
      const note: Note = { x: width + 4, y: this.#y + 9, age: 0 }
      const view: PlanView = this.planView()
      if (
        this.#suit !== 'jetpack' ||
        !overlaps(wireWindow(view.world, view.hazards.wires), noteArrival(view.world, note))
      ) {
        this.#notes.push(note)
        this.#untilNext = 40 + gap / 2
      } else {
        this.#untilNext = this.#spawnKeyframes(top, bottom) + gap
      }
    } else if (Math.random() < 0.42) {
      this.#untilNext = this.#spawnKeyframes(top, bottom) + gap
    } else {
      let room: number = 0
      const wires: Wire[] | null =
        this.#safely((): Hazards => {
          const candidate: Wire[] = []
          room = this.#spawnWires(top, bottom, ramp, candidate)
          return { wires: candidate, lasers: [] }
        }, 8)?.wires ?? null
      const view: PlanView = this.planView()
      const window = wires ? wireWindow(view.world, wires) : null
      const missileDue: boolean = view.hazards.notes.some((note: Note): boolean =>
        overlaps(window, noteArrival(view.world, note)),
      )
      if (wires && missileDue && this.#suit === 'jetpack') {
        // A missile is on its way; hold the wires back until it has passed.
        this.#untilNext = 30
      } else if (wires) {
        this.#wires.push(...wires)
        this.#untilNext = room + gap
      } else {
        this.#untilNext = this.#spawnKeyframes(top, bottom) + gap
      }
    }
  }

  /**
   * Rolls new hazards until the player still has a way through: a run of hold and let-go
   * presses, flown with the real jetpack physics, that clears everything now in play plus the new
   * hazards. Gives up after a few tries, and the caller spawns keyframes instead. Suits skip the
   * check, since a suit absorbs a hit.
   */
  #safely(roll: () => Hazards, attempts: number): Hazards | null {
    for (let attempt: number = 0; attempt < attempts; attempt += 1) {
      const candidate: Hazards = roll()
      if (this.#suit !== 'jetpack' || this.#routeExists(candidate)) return candidate
    }
    return null
  }

  #routeExists(extra: Hazards): boolean {
    const view = this.planView()
    const hazards: PlanHazards = {
      wires: [...view.hazards.wires, ...extra.wires],
      lasers: [...view.hazards.lasers, ...extra.lasers],
      notes: view.hazards.notes,
    }
    const horizon: number = clearHorizon(view.world, hazards)
    return findRoute(view.world, hazards, view.start, view.feel, horizon) !== null
  }

  /** Everything the route finder needs: the room, the hazards, and the player's motion. */
  planView(): PlanView {
    return {
      world: {
        speed: this.#speed,
        floor: this.#floor,
        ceiling: this.#ceiling,
        playerX: PLAYER_X,
        height: SUIT_SIZES.jetpack.height,
        box: SUIT_SIZES.jetpack.box,
        laserWarn: LASER_WARN,
        laserFire: LASER_FIRE,
        noteTrack: NOTE_TRACK,
        noteLock: NOTE_LOCK,
        noteSpeed: this.#speed + 4.5,
      },
      hazards: { wires: this.#wires, lasers: this.#lasers, notes: this.#notes },
      start: {
        y: this.#y,
        vy: this.#vy,
        holdTicks: this.#holdTicks,
        releaseTicks: this.#releaseTicks,
        shield: this.#shield,
      },
      feel: feelFrom(getSettings().jetpack),
      suit: this.#suit,
      running: this.#phase === 'running',
      meters: Math.floor(this.#distance / PIXELS_PER_METER),
      crashes: this.#crashes,
    }
  }

  /** A burst of projector beams across fixed lanes, always leaving at least one lane clear. */
  #startLasers(ramp: number, into: Laser[]): void {
    const top: number = this.#ceiling + 8
    const bottom: number = this.#floor - 8
    const lanes: number[] = [0, 1, 2, 3, 4].map((lane: number): number =>
      Math.round(top + (lane * (bottom - top)) / 4),
    )
    const count: number = Math.min(3, 1 + Math.floor(Math.random() * (1 + ramp * 2.5)))
    const chosen: number[] = [...lanes].sort(() => Math.random() - 0.5).slice(0, count)
    for (const y of chosen) into.push({ y, delay: 0, age: 0 })
    // Later in a run a second wave follows on different lanes.
    if (ramp > 0.5 && Math.random() < 0.6) {
      const second: number[] = lanes.filter((y: number): boolean => !chosen.includes(y)).slice(0, 2)
      for (const y of second) into.push({ y, delay: LASER_WARN + LASER_FIRE - 10, age: 0 })
    }
  }

  /** Lays out a keyframe pattern starting just off screen; returns its width. */
  #spawnKeyframes(top: number, bottom: number): number {
    const start: number = stage.width + 8
    const points: { x: number; y: number }[] = []
    const kind: number = Math.floor(Math.random() * 5)
    if (kind === 0) {
      // A word, spelled in keyframes with the arcade's own font.
      const word: string = pick(WORDS)
      const spacing: number = 6
      ;[...word].forEach((letter: string, index: number): void => {
        glyphRows(letter).forEach((row: string, y: number): void => {
          for (let x: number = 0; x < row.length; x += 1) {
            if (row[x] === '#')
              points.push({ x: index * spacing * 6 + x * spacing, y: y * spacing })
          }
        })
      })
    } else if (kind === 1) {
      // A sine wave.
      for (let index: number = 0; index < 16; index += 1) {
        points.push({ x: index * KEYFRAME_SPACING, y: 20 + Math.round(Math.sin(index / 2.2) * 18) })
      }
    } else if (kind === 2) {
      // A solid block.
      for (let row: number = 0; row < 3; row += 1) {
        for (let col: number = 0; col < 9; col += 1)
          points.push({ x: col * KEYFRAME_SPACING, y: row * KEYFRAME_SPACING })
      }
    } else if (kind === 3) {
      // An arrow pointing the way.
      for (let index: number = 0; index < 6; index += 1) {
        points.push({ x: index * KEYFRAME_SPACING, y: index * KEYFRAME_SPACING })
        points.push({ x: index * KEYFRAME_SPACING, y: 70 - index * KEYFRAME_SPACING })
      }
      for (let index: number = 0; index < 6; index += 1)
        points.push({ x: index * KEYFRAME_SPACING, y: 35 })
    } else {
      // A long straight line.
      for (let index: number = 0; index < 14; index += 1)
        points.push({ x: index * KEYFRAME_SPACING, y: 0 })
    }
    const patternHeight: number = Math.max(...points.map((point) => point.y))
    const patternWidth: number = Math.max(...points.map((point) => point.x))
    const offset: number = top + Math.random() * Math.max(0, bottom - top - patternHeight)
    points.forEach((point, index: number): void => {
      this.#keyframeList.push({ x: start + point.x, y: offset + point.y, seed: index })
    })
    return patternWidth
  }

  /** One or two live wires; returns the room they take up. */
  #spawnWires(top: number, bottom: number, ramp: number, into: Wire[]): number {
    const start: number = stage.width + 30
    const band: number = bottom - top
    const count: number = ramp > 0.3 && Math.random() < 0.5 ? 2 : 1
    for (let index: number = 0; index < count; index += 1) {
      const x: number = start + index * 70
      const style: number = Math.floor(Math.random() * (ramp > 0.3 ? 5 : 3))
      const seed: number = Math.floor(Math.random() * 100)
      if (style === 4) {
        // A gate: two wires from the ceiling and the floor, with a gap to fly through.
        const gapSize: number = 46
        const gapTop: number = top + 10 + Math.random() * (band - gapSize - 20)
        const upper: number = gapTop - top
        const lower: number = bottom - (gapTop + gapSize)
        if (upper > 10)
          into.push({
            x,
            y: top + upper / 2,
            length: upper,
            angle: Math.PI / 2,
            spin: 0,
            seed,
          })
        if (lower > 10)
          into.push({
            x,
            y: bottom - lower / 2,
            length: lower,
            angle: Math.PI / 2,
            spin: 0,
            seed: seed + 1,
          })
        continue
      }
      const length: number =
        style === 0 ? 30 + Math.random() * 22 : Math.min(band * 0.45, 34 + Math.random() * 26)
      const angle: number =
        style === 0
          ? 0
          : style === 1
            ? Math.PI / 2
            : style === 2
              ? (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 4)
              : Math.random() * Math.PI
      const spin: number = style === 3 ? (Math.random() < 0.5 ? 1 : -1) * 0.03 : 0
      const half: number = style === 3 ? length / 2 : (Math.abs(Math.sin(angle)) * length) / 2
      const y: number = top + half + Math.random() * Math.max(0, band - half * 2)
      into.push({ x, y, length, angle, spin, seed })
    }
    return count * 70
  }

  #collect(): void {
    const box: Box = this.#playerBox()
    const kept: Keyframe[] = []
    for (const keyframe of this.#keyframeList) {
      const inside: boolean =
        keyframe.x + 3 > box.left &&
        keyframe.x - 3 < box.right &&
        keyframe.y + 3 > box.top &&
        keyframe.y - 3 < box.bottom
      if (!inside) {
        kept.push(keyframe)
        continue
      }
      this.#keyframes += 1
      if (this.#ticks - this.#lastCoinSound > 4) {
        this.#sound.play('coin')
        this.#lastCoinSound = this.#ticks
      }
    }
    this.#keyframeList = kept

    const centerX: number = (box.left + box.right) / 2
    const centerY: number = (box.top + box.bottom) / 2
    if (this.#token) {
      const tokenY: number = this.#token.y + Math.sin(this.#token.age / 18) * 16
      if (Math.abs(this.#token.x - centerX) < 12 && Math.abs(tokenY - centerY) < 14) {
        this.#tokens += 1
        this.#popup(this.#token.x, tokenY, 'PLAY TOKEN!')
        this.#burst(this.#token.x, tokenY, ['#ffd21a', '#ffffff'], 16)
        this.#sound.play('bonus')
        this.#token = null
      }
    }
    if (this.#suitBox) {
      const boxY: number = this.#suitBox.y + Math.sin(this.#suitBox.age / 14) * 3
      if (Math.abs(this.#suitBox.x - centerX) < 11 && Math.abs(boxY - centerY) < 13) {
        this.#suitBox = null
        this.#startSuiting(pick(SUITS))
      }
    }
  }

  /**
   * Starts putting on a suit. The room slows, the way ahead clears, and over a couple of seconds
   * the editor flickers into the suit while its name and a big look at it fill the screen.
   */
  #startSuiting(suit: Suit): void {
    this.#phase = 'suiting'
    this.#pendingSuit = suit
    this.#suitingFor = 0
    this.#vy = 0
    // Suits never get lasers, as in Jetpack Joyride.
    this.#lasers = []
    this.#notes = []
    this.#wires = this.#wires.filter((wire: Wire): boolean => wire.x > PLAYER_X + 260)
    this.#burst(PLAYER_X + 6, this.#y + 9, ['#a855f7', '#ffffff', '#ffd21a', '#22d3ee'], 26)
    this.#sound.play('start')
  }

  #suiting(settings: JetpackSection): void {
    this.#suitingFor += 1
    this.#runTicks += 1
    const ramp: number = this.#ramp(settings)
    const cruising: number = settings.startSpeed + (settings.topSpeed - settings.startSpeed) * ramp
    this.#speed = cruising * 0.45
    this.#distance += this.#speed
    this.#scroll()
    this.#collect()
    // Ease toward where the suit will stand: the floor for walkers, a safe height for flyers.
    const height: number = SUIT_SIZES[this.#pendingSuit].height
    const walker: boolean = this.#pendingSuit === 'rig' || this.#pendingSuit === 'hog'
    const target: number = walker
      ? this.#floor - height
      : Math.min(Math.max(this.#y, this.#ceiling + 20), this.#floor - height - 20)
    this.#y += (target - this.#y) * 0.08
    if (this.#suitingFor % 30 === 0 && this.#suitingFor < SUIT_TICKS) this.#sound.play('letter')
    if (this.#suitingFor >= SUIT_TICKS) {
      this.#wear(this.#pendingSuit)
      this.#phase = 'running'
    }
  }

  #wear(suit: Suit): void {
    this.#suit = suit
    this.#suitsWorn += 1
    this.#gravity = 1
    this.#vy = 0
    const height: number = SUIT_SIZES[suit].height
    this.#y = Math.min(this.#y, this.#floor - height)
    this.#shield = 40
    this.#burst(PLAYER_X + 8, this.#y + height / 2, ['#a855f7', '#ffffff', '#ffd21a'], 24)
    this.#sound.play('go')
  }

  /** The Road Hog's guns fire on their own and break live wires apart for a bonus. */
  #hogGuns(): void {
    if (this.#runTicks % 18 === 0) this.#bullets.push({ x: PLAYER_X + 20, y: this.#y + 7 })
    this.#bullets = this.#bullets.filter((bullet): boolean => {
      for (const wire of this.#wires) {
        const [x1, y1, x2, y2] = wireEnds(wire)
        const box: Box = {
          left: bullet.x - 1,
          top: bullet.y - 1,
          right: bullet.x + 3,
          bottom: bullet.y + 1,
        }
        if (segmentHits(box, x1, y1, x2, y2, 1)) {
          this.#wires = this.#wires.filter((other: Wire): boolean => other !== wire)
          this.#keyframes += 5
          this.#popup(wire.x, wire.y, '+5')
          this.#burst(wire.x, wire.y, ['#ff2a2a', '#ff9a9a', '#ffffff'], 16)
          this.#sound.play('explode')
          return false
        }
      }
      return true
    })
  }

  #hazards(): void {
    let hit: boolean = false
    const box: Box = this.#playerBox()

    for (const wire of this.#wires) {
      const [x1, y1, x2, y2] = wireEnds(wire)
      if (segmentHits(box, x1, y1, x2, y2, 1)) hit = true
    }

    for (const laser of this.#lasers) {
      if (laser.delay > 0) {
        laser.delay -= 1
        continue
      }
      laser.age += 1
      if (laser.age === LASER_WARN) this.#sound.play('crash')
      const firing: boolean = laser.age >= LASER_WARN && laser.age < LASER_WARN + LASER_FIRE
      if (firing && box.bottom > laser.y - 3 && box.top < laser.y + 3) hit = true
    }
    this.#lasers = this.#lasers.filter(
      (laser: Laser): boolean => laser.delay > 0 || laser.age < LASER_WARN + LASER_FIRE,
    )

    for (const note of this.#notes) {
      note.age += 1
      // A beep each time the warning lights up, faster and faster.
      const flashes: number = Math.floor(warningFlashes(note.age))
      if (
        note.age < NOTE_TRACK + NOTE_LOCK &&
        flashes !== Math.floor(warningFlashes(note.age - 1)) &&
        flashes % 2 === 0
      ) {
        this.#sound.play('move')
      }
      if (note.age === NOTE_TRACK + NOTE_LOCK) this.#sound.play('dive')
      if (note.age < NOTE_TRACK) {
        // The warning follows the player's height, then locks before the note flies in.
        note.y += (this.#y + 9 - note.y) * 0.12
      } else if (note.age >= NOTE_TRACK + NOTE_LOCK) {
        note.x -= this.#speed + 4.5
        if (
          note.x < box.right &&
          note.x + 13 > box.left &&
          note.y + 4 > box.top &&
          note.y - 4 < box.bottom
        )
          hit = true
      }
    }
    this.#notes = this.#notes.filter((note: Note): boolean => note.x > -24)

    if (hit && this.#shield === 0) this.#takeHit()
  }

  #takeHit(): void {
    const box: Box = this.#playerBox()
    if (this.#suit !== 'jetpack') {
      // A suit absorbs the hit and falls apart; the editor flies on, blinking.
      this.#burst(
        (box.left + box.right) / 2,
        (box.top + box.bottom) / 2,
        ['#a855f7', '#ff6319', '#ffffff'],
        26,
      )
      this.#popup(PLAYER_X + 8, this.#y, 'SUIT LOST', '#ff8fa3')
      this.#suit = 'jetpack'
      this.#gravity = 1
      this.#vy = -1.5
      this.#shield = SHIELD_TICKS
      this.#sound.play('explode')
      return
    }
    this.#phase = 'crashing'
    this.#crashes += 1
    this.#crashFor = 0
    this.#vy = -2.4
    this.#burst(PLAYER_X + 6, this.#y + 9, ['#ff3030', '#ffd21a', '#ffffff'], 24)
    this.#sound.play('crash')
  }

  #crashing(): void {
    this.#crashFor += 1
    // The editor tumbles to the floor while the room slides to a stop.
    this.#speed *= 0.96
    this.#distance += this.#speed
    this.#scroll()
    this.#vy += 0.22
    this.#y += this.#vy
    const floor: number = this.#floor - SUIT_SIZES.jetpack.height
    if (this.#y >= floor) {
      this.#y = floor
      this.#vy = Math.abs(this.#vy) > 1 ? -Math.abs(this.#vy) * 0.4 : 0
    }
    for (const note of this.#notes) note.x -= this.#speed + 4.5
    if (this.#crashFor < CRASH_TICKS) return
    if (this.#tokens > 0) {
      this.#phase = 'slot'
      this.#slot = {
        reels: ['take2', 'bonus', 'spins'],
        prize: 'none',
        age: -1,
        idle: 0,
        suit: 'rig',
      }
    } else {
      this.#phase = 'done'
    }
  }

  #slotStep(input: InputFrame, settings: JetpackSection): void {
    const slot = this.#slot
    if (slot.age < 0) {
      // Waiting for a pull. It pulls itself if nobody presses anything.
      slot.idle += 1
      if (input.pressed('fly') || input.pressed('confirm') || slot.idle > SLOT_AUTO_PULL)
        this.#pull(settings)
      return
    }
    slot.age += 1
    if (SLOT_STOPS.includes(slot.age)) this.#sound.play('letter')
    const last: number = SLOT_STOPS[SLOT_STOPS.length - 1]!
    if (slot.age === last + 6) {
      this.#sound.play(slot.prize === 'none' ? 'back' : 'reward')
      if (slot.prize === 'bonus') this.#keyframes += BONUS_KEYFRAMES
      if (slot.prize === 'spins') this.#tokens += 3
    }
    if (slot.age < last + 6 + SLOT_RESULT) return
    if (slot.prize === 'take2' || slot.prize === 'suit') {
      this.#revive(slot.prize === 'suit' ? slot.suit : 'jetpack')
      return
    }
    if (this.#tokens > 0) {
      slot.age = -1
      slot.idle = 0
    } else {
      this.#phase = 'done'
    }
  }

  #pull(settings: JetpackSection): void {
    this.#tokens -= 1
    const { reels, prize } = rollSlot(settings.slotWin, Math.random)
    this.#slot.reels = reels
    this.#slot.prize = prize
    this.#slot.suit = pick(SUITS)
    this.#slot.age = 0
    this.#sound.play('select')
  }

  /** Back in the air after a slot machine win, with the way ahead cleared. */
  #revive(suit: Suit): void {
    this.#phase = 'running'
    this.#suit = 'jetpack'
    this.#y = Math.round((this.#ceiling + this.#floor) / 2) - 9
    this.#vy = 0
    this.#lasers = []
    this.#notes = []
    this.#wires = this.#wires.filter((wire: Wire): boolean => wire.x > PLAYER_X + 160)
    this.#shield = REVIVE_SHIELD
    if (suit !== 'jetpack') {
      this.#startSuiting(suit)
      return
    }
    this.#popup(PLAYER_X + 10, this.#y - 4, 'TAKE 2!')
    this.#sound.play('go')
  }

  draw(context: CanvasRenderingContext2D, hud: Hud): void {
    const width: number = stage.width
    const height: number = stage.height
    const floor: number = this.#floor
    const ticks: number = this.#runTicks
    drawRoom(context, this.#room, width, HUD_HEIGHT, floor, height, this.#distance, ticks)

    for (const keyframe of this.#keyframeList)
      drawKeyframe(context, keyframe.x, keyframe.y, this.#ticks, keyframe.seed)
    if (this.#token) {
      drawToken(
        context,
        this.#token.x,
        this.#token.y + Math.sin(this.#token.age / 18) * 16,
        this.#ticks,
      )
    }
    if (this.#suitBox)
      drawSuitBox(
        context,
        this.#suitBox.x,
        this.#suitBox.y + Math.sin(this.#suitBox.age / 14) * 3,
        this.#ticks,
      )
    for (const wire of this.#wires) {
      const [x1, y1, x2, y2] = wireEnds(wire)
      drawWire(context, x1, y1, x2, y2, this.#ticks, wire.seed)
    }
    for (const laser of this.#lasers) {
      if (laser.delay > 0) continue
      drawLaser(context, width, laser.y, this.#ticks, laser.age >= LASER_WARN)
    }
    for (const note of this.#notes) {
      if (note.age < NOTE_TRACK + NOTE_LOCK)
        drawMissileWarning(context, width - 13, note.y, warningLit(note.age))
      else drawMissile(context, note.x, note.y, this.#ticks)
    }
    for (const bullet of this.#bullets) {
      rect(context, bullet.x - 1, bullet.y - 1, 6, 4, '#000000')
      rect(context, bullet.x, bullet.y, 4, 2, '#fde047')
    }

    if (this.#suit === 'jumpCut' && this.#phase === 'running') {
      // The marker shows where the next cut lands.
      const marker: number = this.#cutMarker()
      const color: string = Math.floor(this.#ticks / 4) % 2 === 0 ? '#ff4fd8' : '#c026d3'
      rect(context, PLAYER_X + 20, marker, 6, 2, color)
      rect(context, PLAYER_X + 20, marker + 16, 6, 2, color)
      rect(context, PLAYER_X + 20, marker, 2, 18, color)
      text(context, 'CUT', PLAYER_X + 28, marker + 6, color, { shadow: false })
    }
    const blinking: boolean = this.#shield > 0 && Math.floor(this.#shield / 4) % 2 === 0
    if (this.#phase === 'suiting') {
      this.#drawSuiting(context)
    } else if (!blinking) {
      drawPlayer(context, {
        suit: this.#phase === 'running' ? this.#suit : 'jetpack',
        x: PLAYER_X,
        y: this.#y,
        ticks: this.#runTicks,
        grounded: this.#grounded,
        thrusting: this.#thrusting,
        upsideDown: this.#gravity === -1,
        crashed: this.#phase !== 'running',
      })
    }

    for (const spark of this.#sparks) rect(context, spark.x, spark.y, 1, 1, spark.color)
    for (const popup of this.#popups) {
      text(context, popup.label, popup.x, popup.y - popup.age / 3 - 6, popup.color, {
        align: 'center',
      })
    }

    // A door sign for each new room.
    const intoRoom: number = this.#runTicks % ROOM_TICKS
    if (this.#phase === 'running' && intoRoom < SIGN_TICKS) {
      drawRoomSign(context, this.#room.name, width / 2, HUD_HEIGHT + 8)
    }

    this.#drawHud(context, hud)
    if (this.#phase === 'slot') this.#drawSlot(context)
  }

  /**
   * The suit-up sequence: the editor flickers between their own look and the suit, faster and
   * faster, while a big look at the suit and its name slide in, like Jetpack Joyride's vehicle intro.
   */
  #drawSuiting(context: CanvasRenderingContext2D): void {
    const width: number = stage.width
    const age: number = this.#suitingFor
    const suit: Suit = this.#pendingSuit
    const size = SUIT_SIZES[suit]
    const interval: number = Math.max(2, 14 - Math.floor(age / 11))
    const showSuit: boolean = age > SUIT_TICKS - 24 || Math.floor(age / interval) % 2 === 1
    const heroBottom: number = this.#y + SUIT_SIZES.jetpack.height
    const pose = (shown: Suit, x: number, y: number) => ({
      suit: shown,
      x,
      y,
      ticks: this.#runTicks,
      grounded: shown === 'rig' || shown === 'hog',
      thrusting: true,
      upsideDown: false,
      crashed: false,
    })
    // A dark band across the middle, the suit at twice its size, and its name in big letters.
    const middle: number = Math.round((this.#ceiling + this.#floor) / 2)
    const slide: number = Math.max(0, 1 - age / 16)
    context.globalAlpha = Math.min(0.55, age / 20)
    rect(context, 0, middle - 30, width, 60, '#000000')
    context.globalAlpha = 1
    if (age < 6) {
      context.globalAlpha = 0.6 * (1 - age / 6)
      rect(context, 0, HUD_HEIGHT, width, stage.height - HUD_HEIGHT, '#ffffff')
      context.globalAlpha = 1
    }
    if (showSuit) drawPlayer(context, pose(suit, PLAYER_X, heroBottom - size.height))
    else drawPlayer(context, pose('jetpack', PLAYER_X, this.#y))
    const words: string[] = SUIT_NAMES[suit].split(' ')
    const nameWidth: number = Math.max(...words.map((word: string): number => textWidth(word, 3)))
    const portraitWidth: number = size.width * 2
    const blockWidth: number = portraitWidth + 10 + nameWidth
    const left: number = Math.round(width / 2 - blockWidth / 2 + PLAYER_X / 2 + slide * width)
    context.save()
    context.translate(left, middle - size.height)
    context.scale(2, 2)
    drawPlayer(context, pose(suit, 0, 0))
    context.restore()
    const nameLeft: number = left + portraitWidth + 10
    text(context, 'SUIT UP!', nameLeft, middle - 27, '#d8b4fe')
    words.forEach((word: string, index: number): void => {
      text(context, word, nameLeft, middle - 17 + index * 24, INK, { scale: 3 })
    })
  }

  #drawHud(context: CanvasRenderingContext2D, hud: Hud): void {
    const width: number = stage.width
    rect(context, 0, 0, width, HUD_HEIGHT, '#03040c')
    text(context, `${pad(Math.floor(this.#distance / PIXELS_PER_METER), 4)}M`, 4, 2, INK)
    drawKeyframe(context, 44, 5, this.#ticks, 0)
    text(context, pad(this.#keyframes, 3), 50, 2, '#ffd21a')
    for (let index: number = 0; index < MAX_TOKENS; index += 1) {
      const have: boolean = index < this.#tokens
      if (have) drawToken(context, 80 + index * 9, 5, this.#ticks, 3)
      else rect(context, 78 + index * 9, 3, 5, 5, '#2a2f45')
    }
    if (hud.secondsLeft !== null) {
      text(context, `TIME ${hud.secondsLeft}`, width / 2 + 30, 2, clockColor(hud.secondsLeft), {
        align: 'center',
      })
    }
    text(context, `BEST ${pad(Math.max(this.#best, this.score), 4)}`, width - 4, 2, MUTED, {
      align: 'right',
    })
  }

  /** The slot machine: three reels, a lever, and one play token per pull. */
  #drawSlot(context: CanvasRenderingContext2D): void {
    const width: number = stage.width
    const height: number = stage.height
    const slot = this.#slot
    context.globalAlpha = 0.72
    rect(context, 0, HUD_HEIGHT, width, height - HUD_HEIGHT, '#000000')
    context.globalAlpha = 1
    const cabinetWidth: number = 140
    const cabinetHeight: number = 84
    const left: number = Math.round(width / 2 - cabinetWidth / 2)
    const top: number = Math.round(HUD_HEIGHT + (height - HUD_HEIGHT - cabinetHeight) / 2) - 8
    rect(context, left - 2, top - 2, cabinetWidth + 4, cabinetHeight + 4, '#000000')
    rect(context, left, top, cabinetWidth, cabinetHeight, '#b91c1c')
    rect(context, left + 3, top + 3, cabinetWidth - 6, 13, '#450a0a')
    const bulbs: boolean = Math.floor(this.#ticks / 8) % 2 === 0
    text(context, 'LUCKY TAKE', width / 2, top + 6, bulbs ? '#ffd21a' : '#f59e0b', {
      align: 'center',
      shadow: false,
    })

    const last: number = SLOT_STOPS[SLOT_STOPS.length - 1]!
    slot.reels.forEach((symbol: SlotSymbol, index: number): void => {
      const x: number = left + 16 + index * 38
      const y: number = top + 22
      rect(context, x - 1, y - 1, 34, 34, '#000000')
      rect(context, x, y, 32, 32, '#f2f2f2')
      const stopped: boolean = slot.age < 0 || slot.age >= (SLOT_STOPS[index] ?? 0)
      if (stopped) {
        drawSlotSymbol(context, symbol, x + 16, y + 16, this.#ticks)
      } else {
        // Spinning: symbols race down through the window.
        context.save()
        context.beginPath()
        context.rect(x, y, 32, 32)
        context.clip()
        const offset: number = (slot.age * 6) % 32
        const spinning: SlotSymbol =
          SLOT_SYMBOLS[Math.floor(slot.age / 5 + index) % SLOT_SYMBOLS.length]!
        const next: SlotSymbol =
          SLOT_SYMBOLS[(Math.floor(slot.age / 5 + index) + 1) % SLOT_SYMBOLS.length]!
        drawSlotSymbol(context, spinning, x + 16, y + 16 + offset, this.#ticks)
        drawSlotSymbol(context, next, x + 16, y + 16 + offset - 32, this.#ticks)
        context.restore()
      }
      // Winning reels flash once they all line up.
      if (slot.age > last && slot.prize !== 'none' && Math.floor(this.#ticks / 6) % 2 === 0) {
        rect(context, x - 1, y - 1, 34, 2, '#ffd21a')
        rect(context, x - 1, y + 31, 34, 2, '#ffd21a')
      }
    })
    // The lever, down while the reels spin.
    const pulled: boolean = slot.age >= 0 && slot.age < 20
    rect(context, left + cabinetWidth, top + 30, 6, 4, '#3a3f55')
    rect(
      context,
      left + cabinetWidth + 4,
      pulled ? top + 30 : top + 12,
      2,
      pulled ? 22 : 20,
      '#c9cede',
    )
    leverKnob(context, left + cabinetWidth + 5, pulled ? top + 54 : top + 10, 3)

    // Tokens left, as coins under the reels.
    for (let index: number = 0; index < Math.min(this.#tokens, 8); index += 1) {
      drawToken(context, left + 18 + index * 10, top + cabinetHeight - 13, this.#ticks, 4)
    }
    const status: string =
      slot.age > last
        ? prizeLabel(slot.prize, slot.suit)
        : slot.age >= 0
          ? 'GOOD LUCK...'
          : `PRESS ${actionKey('fly')} TO PULL`
    const color: string = slot.age > last && slot.prize !== 'none' ? '#ffd21a' : INK
    text(context, status, width / 2, top + cabinetHeight + 8, color, {
      align: 'center',
      maxWidth: width - 8,
    })
    text(
      context,
      `${this.#tokens} TOKEN${this.#tokens === 1 ? '' : 'S'} LEFT`,
      left + cabinetWidth - 6,
      top + cabinetHeight - 15,
      '#fde68a',
      {
        align: 'right',
        shadow: false,
      },
    )
  }
}

function leverKnob(context: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  rect(context, x - radius, y - radius, radius * 2 + 1, radius * 2 + 1, '#000000')
  rect(context, x - radius + 1, y - radius + 1, radius * 2 - 1, radius * 2 - 1, '#ef4444')
}

export const JETPACK: GameDefinition = {
  id: 'jetpack',
  keys: [{ action: 'fly', label: 'HOLD TO FLY' }],
  pauseKey: { action: 'back', label: 'PAUSE' },
  pauseActions: ['back'],
  create: (sound: Sound, best: number): Game => new JetpackGame(sound, best),
  drawPreview(context, x, y, width, height, frame): void {
    // The editor bobbing through the edit bay past a wave of keyframes and a live wire.
    context.save()
    context.translate(x, y)
    const floor: number = height - 8
    drawRoom(
      context,
      ROOMS[Math.floor(frame / 300) % ROOMS.length]!,
      width,
      0,
      floor,
      height,
      frame * 2,
      frame,
    )
    for (let index: number = 0; index < 8; index += 1) {
      const keyX: number =
        ((((index * 12 - frame * 2) % (width + 40)) + width + 40) % (width + 40)) - 10
      drawKeyframe(context, keyX, height / 2 + Math.sin(index / 1.5) * 10, frame, index)
    }
    const wireX: number = width - ((frame * 2) % (width + 40)) + 20
    drawWire(context, wireX, 8, wireX, 28, frame, 3)
    const heroY: number = height / 2 - 8 + Math.round(Math.sin(frame / 20) * 12)
    drawPlayer(context, {
      suit: 'jetpack',
      x: 16,
      y: heroY,
      ticks: frame,
      grounded: false,
      thrusting: Math.cos(frame / 20) < 0,
      upsideDown: false,
      crashed: false,
    })
    context.restore()
  },
}
