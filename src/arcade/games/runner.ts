import { BOUNCE_COLORS } from '../../lib/bounce'
import type { Sound } from '../audio'
import type { InputFrame } from '../input'
import {
  BRAND,
  DANGER,
  GOLD,
  INK,
  MUTED,
  NIGHT,
  clockColor,
  draw,
  pad,
  rect,
  stage,
  text,
} from '../pixel'
import { getSettings } from '../../lib/boothStore'
import type { RunnerSection } from '../../lib/booth'
import {
  REEL_FRAMES,
  SETS,
  drawCamera,
  drawGround,
  drawProp,
  drawSlate,
  type Prop,
  type SceneSet,
} from './onset'
import type { Game, GameDefinition, Hud } from './types'

// On Set: a camera on a dolly rolls across a film set, jumping cables and apple boxes, ducking
// boom mics, and collecting film reels. Every 15 seconds the crew slates a new scene.

/** Room below the ground line. */
const GROUND_DEPTH: number = 28
const PLAYER_X: number = 36
const GRAVITY: number = 0.34
const HELD_GRAVITY: number = 0.22
const DUCK_GRAVITY: number = 0.95
const JUMP_SPEED: number = 5.4
const JUMP_BUFFER: number = 8
/** Ticks a tapped jump stays in the air, which sets the least room between obstacles. */
const SHORT_JUMP_TICKS: number = 32
const COIN_POINTS: number = 25
const DEATH_TICKS: number = 70
/** Each scene lasts this long before the set changes. */
const SCENE_TICKS: number = 900
/** How long the wipe between sets takes. */
const WIPE_TICKS: number = 30
/** How long the clapperboard stays up for each new scene. */
const SLATE_TICKS: number = 80
/** When the clapper snaps shut, in ticks after the slate appears. */
const SNAP_TICK: number = 22

interface Obstacle {
  kind: Prop
  x: number
  /** Height of the obstacle's bottom edge above the ground. */
  lift: number
  width: number
  height: number
}

interface Coin {
  x: number
  lift: number
  taken: boolean
}

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

const SIZES: Record<Prop, { width: number; height: number; lift: number }> = {
  cable: { width: 11, height: 8, lift: 0 },
  cStand: { width: 12, height: 17, lift: 0 },
  appleBoxes: { width: 22, height: 11, lift: 0 },
  light: { width: 13, height: 13, lift: 0 },
  // Boom mics hang in the air: duck under the low one, and don't jump into the high one.
  boomLow: { width: 20, height: 12, lift: 11 },
  boomHigh: { width: 20, height: 12, lift: 30 },
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

interface Popup {
  x: number
  y: number
  label: string
  age: number
}

class RunnerGame implements Game {
  over: boolean = false
  #sound: Sound
  #best: number
  #lift: number = 0
  #velocity: number = 0
  #grounded: boolean = true
  #ducking: boolean = false
  #jumpBuffer: number = 0
  #speed: number
  #distance: number = 0
  #coinPoints: number = 0
  #ticks: number = 0
  #untilSpawn: number = 200
  #obstacles: Obstacle[] = []
  #coins: Coin[] = []
  #popups: Popup[] = []
  #colorIndex: number = 0
  #deadFor: number = 0
  #milestone: number = 0
  /** Arcade pixels per world pixel. Bigger sprites mean a closer, narrower view. */
  readonly #scale: number
  #buffer: HTMLCanvasElement | null = null

  constructor(sound: Sound, best: number) {
    this.#sound = sound
    this.#best = best
    const settings: RunnerSection = getSettings().runner
    this.#scale = settings.spriteScale
    this.#speed = settings.startSpeed
  }

  endTitle(endedBy: 'game over' | 'time'): string {
    return endedBy === 'time' ? "THAT'S A WRAP!" : 'CUT!'
  }

  /** Which scene is on, counting from 0. */
  get #scene(): number {
    return Math.floor(this.#ticks / SCENE_TICKS)
  }

  #set(scene: number): SceneSet {
    return SETS[scene % SETS.length] ?? SETS[0]!
  }

  get score(): number {
    return Math.floor(this.#distance / 10) + this.#coinPoints
  }

  get #dead(): boolean {
    return this.#deadFor > 0
  }

  /** World size, in world pixels. */
  get #width(): number {
    return Math.ceil(stage.width / this.#scale)
  }

  get #height(): number {
    return Math.ceil(stage.height / this.#scale)
  }

  get #ground(): number {
    return this.#height - GROUND_DEPTH
  }

  #playerBox(): Box {
    const bottom: number = this.#ground - this.#lift
    return this.#ducking && this.#grounded
      ? { left: PLAYER_X + 1, top: bottom - 9, right: PLAYER_X + 17, bottom: bottom - 1 }
      : { left: PLAYER_X + 3, top: bottom - 15, right: PLAYER_X + 13, bottom: bottom - 1 }
  }

  /** How far along the difficulty ramp the run is, from 0 to 1. */
  #ramp(settings: RunnerSection): number {
    return Math.min(1, this.#ticks / (settings.rampSeconds * 60))
  }

  #spawn(settings: RunnerSection): void {
    // Tougher obstacles join the mix as the run ramps up.
    const ramp: number = this.#ramp(settings)
    const pool: Prop[] = ['cable', 'cable', 'cStand']
    if (ramp > 0.15) pool.push('appleBoxes', 'light')
    if (ramp > 0.35) pool.push('boomLow', 'boomHigh', 'cStand')
    if (ramp > 0.65) pool.push('boomLow', 'appleBoxes')
    const kind: Prop = pool[Math.floor(Math.random() * pool.length)] ?? 'cable'
    const size: { width: number; height: number; lift: number } = SIZES[kind]
    const spawnX: number = this.#width + 4
    this.#obstacles.push({ kind, x: spawnX, ...size })
    // Always leave room to land a short jump and jump again, then add the spacing setting.
    const minimum: number = this.#speed * SHORT_JUMP_TICKS + 52
    const gap: number = minimum + settings.spacing * (30 + Math.random() * 130)
    this.#untilSpawn = gap
    if (Math.random() < 0.4) {
      const lift: number = Math.random() < 0.5 ? 6 : 34
      for (let index: number = 0; index < 3; index += 1) {
        this.#coins.push({ x: spawnX + gap / 2 + index * 10, lift, taken: false })
      }
    }
  }

  update(input: InputFrame): void {
    this.#ticks += 1
    if (!this.#dead && this.#ticks % SCENE_TICKS === SNAP_TICK) this.#sound.play('count')
    if (this.#deadFor === SNAP_TICK) this.#sound.play('count')
    this.#popups = this.#popups.filter((popup: Popup): boolean => (popup.age += 1) < 36)
    if (this.#dead) {
      this.#deadFor += 1
      if (this.#deadFor > DEATH_TICKS) this.over = true
      return
    }

    // Jumping and ducking
    if (input.pressed('jump')) this.#jumpBuffer = JUMP_BUFFER
    else if (this.#jumpBuffer > 0) this.#jumpBuffer -= 1
    this.#ducking = input.held.has('duck')
    if (this.#grounded && this.#jumpBuffer > 0 && !this.#ducking) {
      this.#grounded = false
      this.#velocity = JUMP_SPEED
      this.#jumpBuffer = 0
      this.#colorIndex = (this.#colorIndex + 1) % BOUNCE_COLORS.length
      this.#sound.play('jump')
    }
    if (!this.#grounded) {
      const rising: boolean = this.#velocity > 0
      const gravity: number = this.#ducking
        ? DUCK_GRAVITY
        : rising && input.held.has('jump')
          ? HELD_GRAVITY
          : GRAVITY
      this.#velocity -= gravity
      this.#lift += this.#velocity
      if (this.#lift <= 0) {
        this.#lift = 0
        this.#velocity = 0
        this.#grounded = true
      }
    }

    // World. Difficulty comes from the admin window and applies live.
    const settings: RunnerSection = getSettings().runner
    this.#speed =
      settings.startSpeed + (settings.topSpeed - settings.startSpeed) * this.#ramp(settings)
    this.#distance += this.#speed
    this.#untilSpawn -= this.#speed
    if (this.#untilSpawn <= 0) this.#spawn(settings)
    for (const obstacle of this.#obstacles) {
      obstacle.x -= this.#speed + (obstacle.kind.startsWith('boom') ? 0.6 : 0)
    }
    for (const coin of this.#coins) coin.x -= this.#speed
    this.#obstacles = this.#obstacles.filter(
      (obstacle: Obstacle): boolean => obstacle.x + obstacle.width > -4,
    )
    this.#coins = this.#coins.filter((coin: Coin): boolean => coin.x > -10 && !coin.taken)

    const player: Box = this.#playerBox()
    const ground: number = this.#ground
    for (const coin of this.#coins) {
      const box: Box = {
        left: coin.x,
        top: ground - coin.lift - 6,
        right: coin.x + 6,
        bottom: ground - coin.lift,
      }
      if (!coin.taken && overlaps(player, box)) {
        coin.taken = true
        this.#coinPoints += COIN_POINTS
        this.#popups.push({ x: coin.x + 3, y: box.top, label: `+${COIN_POINTS}`, age: 0 })
        this.#sound.play('coin')
      }
    }
    for (const obstacle of this.#obstacles) {
      // Hitboxes are a little forgiving, which feels fair at arcade speed.
      const box: Box = {
        left: obstacle.x + 2,
        top: ground - obstacle.lift - obstacle.height + 2,
        right: obstacle.x + obstacle.width - 2,
        bottom: ground - obstacle.lift - 1,
      }
      if (overlaps(player, box)) {
        this.#deadFor = 1
        this.#sound.play('crash')
        return
      }
    }

    const milestone: number = Math.floor(this.score / 250)
    if (milestone > this.#milestone) {
      this.#milestone = milestone
      this.#sound.play('milestone')
    }
  }

  draw(context: CanvasRenderingContext2D, hud: Hud): void {
    if (this.#scale === 1) {
      this.#drawWorld(context, hud)
      return
    }
    // Bigger sprites: draw the world small, then scale it up with hard edges.
    const width: number = this.#width
    const height: number = this.#height
    this.#buffer ??= document.createElement('canvas')
    if (this.#buffer.width !== width || this.#buffer.height !== height) {
      this.#buffer.width = width
      this.#buffer.height = height
    }
    const buffer: CanvasRenderingContext2D | null = this.#buffer.getContext('2d')
    if (!buffer) return
    buffer.imageSmoothingEnabled = false
    this.#drawWorld(buffer, hud)
    context.drawImage(this.#buffer, 0, 0, width * this.#scale, height * this.#scale)
  }

  #drawWorld(context: CanvasRenderingContext2D, hud: Hud): void {
    const width: number = this.#width
    const height: number = this.#height
    const ground: number = this.#ground
    rect(context, 0, 0, width, height, NIGHT)

    // The set, with a wipe from the previous one when a new scene starts.
    const scene: number = this.#scene
    const set: SceneSet = this.#set(scene)
    const intoScene: number = this.#ticks - scene * SCENE_TICKS
    const wiping: boolean = scene > 0 && intoScene < WIPE_TICKS
    const drawSet = (shown: SceneSet): void => {
      shown.background(context, width, ground, this.#distance, this.#ticks)
      drawGround(context, shown, width, height, ground, this.#distance)
    }
    if (wiping) {
      drawSet(this.#set(scene - 1))
      const edge: number = Math.round((intoScene / WIPE_TICKS) * width)
      context.save()
      context.beginPath()
      context.rect(0, 0, edge, height)
      context.clip()
      drawSet(set)
      context.restore()
      rect(context, edge, 0, 2, height, INK)
    } else {
      drawSet(set)
    }

    for (const coin of this.#coins) {
      draw(
        context,
        REEL_FRAMES[Math.floor(this.#ticks / 8) % REEL_FRAMES.length]!,
        coin.x,
        ground - coin.lift - 6,
      )
    }
    for (const obstacle of this.#obstacles) {
      const top: number = ground - obstacle.lift - obstacle.height
      drawProp(
        context,
        obstacle.kind,
        Math.round(obstacle.x),
        top,
        obstacle.width,
        obstacle.height,
        this.#ticks,
      )
    }
    this.#drawPlayer(context)

    for (const popup of this.#popups) {
      text(context, popup.label, popup.x, popup.y - popup.age / 2 - 8, GOLD, { align: 'center' })
    }

    // The clapperboard: ACTION! to start, a new scene every so often, and CUT! on a crash.
    const centerX: number = width / 2
    const open = (age: number): number => (age < SNAP_TICK ? 1 : 0)
    if (this.#dead && !this.over) {
      const age: number = this.#deadFor
      drawSlate(context, centerX, 20, 'CUT!', `SCENE ${scene + 1}`, open(age))
    } else if (!this.#dead && intoScene < SLATE_TICKS) {
      const title: string = scene === 0 ? 'ACTION!' : `SCENE ${scene + 1}`
      drawSlate(context, centerX, 20, title, set.name, open(intoScene))
    }

    if (hud.secondsLeft !== null) {
      text(context, `TIME ${hud.secondsLeft}`, 10, 6, clockColor(hud.secondsLeft))
    }
    text(context, `HI ${pad(Math.max(this.#best, this.score))}`, width - 82, 6, MUTED, {
      align: 'right',
    })
    text(context, pad(this.score), width - 10, 6, INK, { align: 'right' })
  }

  #drawPlayer(context: CanvasRenderingContext2D): void {
    if (this.#dead && Math.floor(this.#deadFor / 5) % 2 === 1) return
    const color: string = this.#dead ? DANGER : (BOUNCE_COLORS[this.#colorIndex] ?? BRAND)
    const bottom: number = Math.round(this.#ground - this.#lift)
    const stride: number = this.#dead ? 0 : Math.floor(this.#distance / 8) % 2
    const pose = this.#ducking && this.#grounded ? 'duck' : this.#grounded ? 'stand' : 'air'
    drawCamera(context, PLAYER_X, bottom, color, pose, stride)
  }
}

export const RUNNER: GameDefinition = {
  id: 'runner',
  keys: [
    { action: 'jump', label: 'JUMP' },
    { action: 'duck', label: 'DUCK' },
  ],
  pauseKey: { action: 'back', label: 'PAUSE' },
  pauseActions: ['back'],
  create: (sound: Sound, best: number): Game => new RunnerGame(sound, best),
  drawPreview(context, x, y, width, height, frame): void {
    // The current scene's set behind a camera that hops a cable as it rolls past.
    const set: SceneSet = SETS[Math.floor(frame / 300) % SETS.length] ?? SETS[0]!
    const ground: number = y + height - 8
    context.save()
    context.translate(x, y)
    set.background(context, width, height - 8, frame * 2, frame)
    drawGround(context, set, width, height, height - 8, frame * 2)
    context.restore()
    const cycle: number = frame % 120
    const cableX: number = x + width - ((cycle * 1.4) % (width + 12))
    drawProp(context, 'cable', cableX, ground - 8, 11, 8, frame)
    const cameraX: number = x + 24
    const distance: number = cableX - cameraX
    const airborne: boolean = distance < 18 && distance > -12
    const progress: number = (18 - distance) / 30
    const lift: number = airborne ? Math.round(Math.sin(progress * Math.PI) * 20) : 0
    const color: string = BOUNCE_COLORS[Math.floor(frame / 120) % BOUNCE_COLORS.length] ?? BRAND
    drawCamera(
      context,
      cameraX,
      ground - lift,
      color,
      airborne ? 'air' : 'stand',
      Math.floor(frame / 6) % 2,
    )
  },
}
