import { BOUNCE_COLORS } from '../../lib/bounce'
import type { Sound } from '../audio'
import type { Action, InputFrame } from '../input'
import {
  BRAND,
  DIM,
  EDGE,
  GOLD,
  INK,
  MUTED,
  NIGHT,
  clockColor,
  draw,
  pad,
  rect,
  sprite,
  stage,
  text,
  textWidth,
} from '../pixel'
import { getSettings } from '../../lib/boothStore'
import type { SnakeSection } from '../../lib/booth'
import type { Game, GameDefinition, Hud } from './types'

// Placeholder art: a snake that grows by eating creative files. Assets get finalized later.

/** Room above the board for the score line. */
const BOARD_TOP: number = 15
const START_LENGTH: number = 4
const BONUS_EVERY: number = 6
const BONUS_TICKS: number = 360
const DEATH_TICKS: number = 80

interface Point {
  x: number
  y: number
}

interface FileKind {
  label: string
  color: string
  points: number
}

const FILE_KINDS: readonly FileKind[] = ['PNG', 'JPG', 'MP4', 'GIF', 'SVG', 'MOV', 'PSD'].map(
  (label: string, index: number): FileKind => ({
    label,
    color: BOUNCE_COLORS[index] ?? BRAND,
    points: 10,
  }),
)
const BONUS_KIND: FileKind = { label: '4K', color: GOLD, points: 50 }

const PAGE: readonly string[] = [
  'ooooo..',
  'owwwfo.',
  'owwwffo',
  'owwwwwo',
  'occccco',
  'occccco',
  'owwwwwo',
  'ooooooo',
]

/** The file art is drawn for 8-pixel squares and scaled to the square size in use. */
const ART_CELL: number = 8

const fileSprites: Map<string, HTMLCanvasElement> = new Map()

export function fileSprite(color: string, bonus: boolean = false): HTMLCanvasElement {
  const key: string = `${color}${bonus}`
  const cached: HTMLCanvasElement | undefined = fileSprites.get(key)
  if (cached) return cached
  const created: HTMLCanvasElement = sprite(PAGE, {
    // The page edge is the page color, so each file is a plain page with no outline.
    o: bonus ? '#fde68a' : '#eef0f7',
    w: bonus ? '#fde68a' : '#eef0f7',
    f: bonus ? '#d4a106' : '#c3c8d8',
    c: color,
  })
  fileSprites.set(key, created)
  return created
}

const DIRECTIONS: Partial<Record<Action, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** A spark thrown off when a file is eaten. */
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

class SnakeGame implements Game {
  score: number = 0
  over: boolean = false
  #sound: Sound
  #best: number
  #body: Point[] = []
  #colors: string[] = []
  #direction: Point = { x: 1, y: 0 }
  #queue: Point[] = []
  #grow: number = 0
  /** Progress toward the next move, in sixtieths of a move. */
  #stepProgress: number = 0
  #eaten: number = 0
  #food: Point & { kind: FileKind } = { x: 0, y: 0, kind: FILE_KINDS[0]! }
  #bonus: (Point & { ticksLeft: number }) | null = null
  #popups: Popup[] = []
  #sparks: Spark[] = []
  /** How many of each file type were eaten, for the game-over summary. */
  #library: Map<string, number> = new Map()
  /** Ticks since the current file appeared, for its drop-in animation. */
  #foodAge: number = 0
  /** Ticks left of the screen shake after a 4K file. */
  #shake: number = 0
  #tick: number = 0
  #deadFor: number = 0
  readonly #cell: number
  readonly #columns: number
  readonly #rows: number

  constructor(sound: Sound, best: number) {
    this.#sound = sound
    this.#best = best
    // The board fills the screen at the start of the game and keeps its size until the end.
    this.#cell = getSettings().snake.cellSize
    this.#columns = Math.max(12, Math.floor((stage.width - 8) / this.#cell))
    this.#rows = Math.max(8, Math.floor((stage.height - BOARD_TOP - 3) / this.#cell))
    const startX: number = Math.floor(this.#columns / 2) - 4
    const startY: number = Math.floor(this.#rows / 2)
    for (let index: number = 0; index < START_LENGTH; index += 1) {
      this.#body.push({ x: startX - index, y: startY })
      this.#colors.push(BRAND)
    }
    this.#placeFood()
  }

  get #dead(): boolean {
    return this.#deadFor > 0
  }

  get #boardX(): number {
    return Math.floor((stage.width - this.#columns * this.#cell) / 2)
  }

  get #boardY(): number {
    const spare: number = stage.height - BOARD_TOP - 3 - this.#rows * this.#cell
    return BOARD_TOP + Math.max(0, Math.floor(spare / 2))
  }

  /** A random empty cell. The current food counts as taken unless it is being replaced. */
  #freeCell(replacingFood: boolean): Point | null {
    const taken: Set<string> = new Set(
      this.#body.map((part: Point): string => `${part.x},${part.y}`),
    )
    if (this.#bonus) taken.add(`${this.#bonus.x},${this.#bonus.y}`)
    if (!replacingFood) taken.add(`${this.#food.x},${this.#food.y}`)
    const free: Point[] = []
    for (let y: number = 0; y < this.#rows; y += 1) {
      for (let x: number = 0; x < this.#columns; x += 1) {
        if (!taken.has(`${x},${y}`)) free.push({ x, y })
      }
    }
    return free[Math.floor(Math.random() * free.length)] ?? null
  }

  #placeFood(): void {
    const cell: Point | null = this.#freeCell(true)
    if (!cell) {
      // The board is full: nothing left to eat.
      this.#die()
      return
    }
    const kind: FileKind =
      FILE_KINDS[Math.floor(Math.random() * FILE_KINDS.length)] ?? FILE_KINDS[0]!
    this.#food = { ...cell, kind }
    this.#foodAge = 0
  }

  /** A burst of sparks from the center of a square, in the eaten file's color. */
  #burst(point: Point, color: string, count: number): void {
    const centerX: number = this.#boardX + point.x * this.#cell + this.#cell / 2
    const centerY: number = this.#boardY + point.y * this.#cell + this.#cell / 2
    for (let index: number = 0; index < count; index += 1) {
      const angle: number = (index / count) * Math.PI * 2 + this.#tick
      const speed: number = 0.8 + (index % 3) * 0.35
      this.#sparks.push({
        x: centerX,
        y: centerY,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        age: 0,
        color: index % 2 ? color : INK,
      })
    }
  }

  /** Segments still drawn: all of them, until a crash pops them off from the tail. */
  #shownSegments(deadFor: number = this.#deadFor): number {
    if (deadFor <= 0) return this.#body.length
    return Math.max(1, Math.ceil(this.#body.length * (1 - deadFor / (DEATH_TICKS - 20))))
  }

  /** What the player collected, most-eaten types first, cut to fit the screen. */
  get summary(): string {
    const counts: [string, number][] = [...this.#library.entries()].sort(
      (a: [string, number], b: [string, number]): number => b[1] - a[1],
    )
    if (counts.length === 0) return 'LIBRARY: EMPTY'
    let line: string = 'LIBRARY:'
    for (let index: number = 0; index < counts.length; index += 1) {
      const [label, count] = counts[index]!
      const next: string = `${line}${index > 0 ? ' ·' : ''} ${count} ${label}`
      const left: number = counts.length - index - 1
      const reserve: string = left > 0 ? ` +${left} MORE` : ''
      if (textWidth(next + reserve) > stage.width - 8) {
        return `${line} +${counts.length - index} MORE`
      }
      line = next
    }
    return line
  }

  #die(): void {
    if (this.#dead) return
    this.#deadFor = 1
    this.#sound.play('crash')
  }

  #popup(point: Point, label: string, color: string): void {
    this.#popups.push({
      x: this.#boardX + point.x * this.#cell + this.#cell / 2,
      y: this.#boardY + point.y * this.#cell - 2,
      label,
      color,
      age: 0,
    })
  }

  update(input: InputFrame): void {
    this.#tick += 1
    this.#foodAge += 1
    if (this.#shake > 0) this.#shake -= 1
    this.#popups = this.#popups.filter((popup: Popup): boolean => (popup.age += 1) < 40)
    this.#sparks = this.#sparks.filter((spark: Spark): boolean => {
      spark.x += spark.dx
      spark.y += spark.dy
      spark.dy += 0.05
      return (spark.age += 1) < 18
    })
    if (this.#dead) {
      const before: number = this.#shownSegments()
      this.#deadFor += 1
      for (let index: number = this.#shownSegments(); index < before; index += 1) {
        const popped: Point | undefined = this.#body[index]
        if (popped) this.#burst(popped, this.#colors[index] ?? BRAND, 4)
      }
      if (this.#deadFor > DEATH_TICKS) this.over = true
      return
    }

    for (const action of input.presses) {
      const turn: Point | undefined = DIRECTIONS[action]
      if (!turn) continue
      const last: Point = this.#queue[this.#queue.length - 1] ?? this.#direction
      const reverses: boolean = turn.x === -last.x && turn.y === -last.y
      const repeats: boolean = turn.x === last.x && turn.y === last.y
      if (!reverses && !repeats && this.#queue.length < 3) this.#queue.push(turn)
    }

    if (this.#bonus) {
      this.#bonus.ticksLeft -= 1
      if (this.#bonus.ticksLeft <= 0) this.#bonus = null
    }

    // Difficulty comes from the admin window and applies live.
    const settings: SnakeSection = getSettings().snake
    this.#stepProgress += this.#speed(settings)
    if (this.#stepProgress < 60) return
    this.#stepProgress -= 60
    this.#advance(settings)
  }

  /** Moves per second right now. */
  #speed(settings: SnakeSection): number {
    const speedups: number = Math.floor(this.#eaten / settings.speedupEvery)
    return Math.min(settings.topSpeed, settings.startSpeed + speedups * settings.speedupBy)
  }

  #advance(settings: SnakeSection): void {
    this.#direction = this.#queue.shift() ?? this.#direction
    const head: Point = this.#body[0]!
    const next: Point = { x: head.x + this.#direction.x, y: head.y + this.#direction.y }
    const growing: boolean = this.#grow > 0
    // The tail moves out of the way this step unless the snake is growing.
    const body: Point[] = growing ? this.#body : this.#body.slice(0, -1)
    const hitsWall: boolean =
      next.x < 0 || next.y < 0 || next.x >= this.#columns || next.y >= this.#rows
    const hitsSelf: boolean = body.some(
      (part: Point): boolean => part.x === next.x && part.y === next.y,
    )
    if (hitsWall || hitsSelf) {
      this.#die()
      return
    }
    this.#body.unshift(next)
    if (growing) this.#grow -= 1
    else this.#body.pop()

    if (next.x === this.#food.x && next.y === this.#food.y) {
      const kind: FileKind = this.#food.kind
      this.#eaten += 1
      this.score += kind.points
      this.#grow += settings.growth
      for (let segment: number = 0; segment < settings.growth; segment += 1) {
        this.#colors.push(kind.color)
      }
      this.#popup(next, `+${kind.points} ${kind.label}`, kind.color)
      this.#burst(next, kind.color, 8)
      this.#library.set(kind.label, (this.#library.get(kind.label) ?? 0) + 1)
      this.#sound.play('eat')
      if (this.#eaten % BONUS_EVERY === 0 && !this.#bonus) {
        const cell: Point | null = this.#freeCell(false)
        if (cell) this.#bonus = { ...cell, ticksLeft: BONUS_TICKS }
      }
      this.#placeFood()
    } else if (this.#bonus && next.x === this.#bonus.x && next.y === this.#bonus.y) {
      this.score += BONUS_KIND.points
      this.#grow += settings.growth * 2
      for (let segment: number = 0; segment < settings.growth * 2; segment += 1) {
        this.#colors.push(GOLD)
      }
      this.#popup(next, `+${BONUS_KIND.points} ${BONUS_KIND.label}`, GOLD)
      this.#burst(next, GOLD, 14)
      this.#library.set(BONUS_KIND.label, (this.#library.get(BONUS_KIND.label) ?? 0) + 1)
      this.#shake = 10
      this.#sound.play('bonus')
      this.#bonus = null
    }
  }

  draw(context: CanvasRenderingContext2D, hud: Hud): void {
    const cell: number = this.#cell
    const boardX: number = this.#boardX
    const boardY: number = this.#boardY
    // Art is drawn for 8-pixel squares; this scales its details to the square size in use.
    const unit = (value: number): number => Math.max(1, Math.round((value * cell) / ART_CELL))
    rect(context, 0, 0, stage.width, stage.height, NIGHT)

    // Status bar
    text(context, `SCORE ${pad(this.score, 4)}`, 10, 4, INK)
    if (hud.secondsLeft === null) {
      text(context, `FILES ${this.#eaten}`, stage.width / 2, 4, MUTED, { align: 'center' })
    } else {
      text(context, `TIME ${hud.secondsLeft}`, stage.width / 2, 4, clockColor(hud.secondsLeft), {
        align: 'center',
      })
    }
    text(context, `BEST ${pad(Math.max(this.#best, this.score), 4)}`, stage.width - 10, 4, MUTED, {
      align: 'right',
    })

    // A 4K file shakes the board for a moment.
    const shakeX: number = this.#shake > 0 ? ((this.#shake % 2) * 2 - 1) * 1 : 0
    context.save()
    context.translate(shakeX, 0)

    // Board: a dark transparency checkerboard, like an empty canvas in an editor.
    const boardWidth: number = this.#columns * cell
    const boardHeight: number = this.#rows * cell
    // Bold edges (for a real TV) draw a thick, bright wall and a lighter field, so the walls
    // stand out clearly from the dark screen around them.
    const bold: boolean = getSettings().picture.boldEdges
    if (bold) {
      rect(context, boardX - 3, boardY - 3, boardWidth + 6, boardHeight + 6, '#c7d0ff')
      rect(context, boardX - 1, boardY - 1, boardWidth + 2, boardHeight + 2, '#05060a')
    } else {
      rect(context, boardX - 1, boardY - 1, boardWidth + 2, boardHeight + 2, EDGE)
    }
    for (let y: number = 0; y < this.#rows; y += 1) {
      for (let x: number = 0; x < this.#columns; x += 1) {
        const even: boolean = (x + y) % 2 === 0
        const shade: string = bold ? (even ? '#161b2c' : '#1b2135') : even ? '#0b0d14' : '#0e111b'
        rect(context, boardX + x * cell, boardY + y * cell, cell, cell, shade)
      }
    }

    // The next file drops in from above.
    const scale: number = cell / ART_CELL
    const bob: number = Math.floor(this.#tick / 20) % 2
    const foodX: number = boardX + this.#food.x * cell
    const foodY: number = boardY + this.#food.y * cell
    const drop: number = this.#foodAge < 10 ? Math.round(((10 - this.#foodAge) / 10) ** 2 * 12) : 0
    draw(context, fileSprite(this.#food.kind.color), foodX, foodY - bob - drop, scale)
    if (this.#bonus && (this.#bonus.ticksLeft > 90 || Math.floor(this.#tick / 6) % 2 === 0)) {
      const bonusX: number = boardX + this.#bonus.x * cell
      const bonusY: number = boardY + this.#bonus.y * cell
      draw(context, fileSprite(GOLD, true), bonusX, bonusY - bob, scale)
      const sparkle: number = Math.floor(this.#tick / 8) % 4
      const sparkles: readonly Point[] = [
        { x: -2, y: -2 },
        { x: cell, y: -1 },
        { x: cell, y: cell },
        { x: -2, y: cell - 1 },
      ]
      const spot: Point = sparkles[sparkle]!
      rect(context, bonusX + spot.x, bonusY + spot.y, 1, 1, '#fff7d6')
    }

    // Snake, tail first so the head sits on top. It is drawn as one continuous tube, inset from
    // the grid so the board shows along its sides, and every segment a file grew keeps that
    // file's color, so the body is a striped record of what was eaten.
    const flashing: boolean = this.#dead && Math.floor(this.#deadFor / 6) % 2 === 0
    // When the snake crashes, its segments pop off one by one from the tail.
    const shown: number = this.#shownSegments()
    // A highlight runs down the body every few seconds.
    const pulse: number = (this.#tick % 150) / 2
    const inset: number = unit(1)
    const thickness: number = cell - 1 - inset * 2
    for (let index: number = shown - 1; index > 0; index -= 1) {
      const part: Point = this.#body[index]!
      const color: string = flashing ? INK : (this.#colors[index] ?? BRAND)
      const x: number = boardX + part.x * cell
      const y: number = boardY + part.y * cell
      // The tail tapers to a point.
      const taper: number = index === shown - 1 && shown > 2 ? unit(1) : 0
      rect(
        context,
        x + inset + taper,
        y + inset + taper,
        thickness - taper * 2,
        thickness - taper * 2,
        color,
      )
      // Join this segment to the one ahead of it across the gap between squares.
      const ahead: Point = this.#body[index - 1]!
      // The tail's join is as narrow as the tail and runs into it, so the tip stays attached.
      const reach: number = cell - thickness + taper
      const across: number = thickness - taper * 2
      const left: number = x + inset + taper
      const top: number = y + inset + taper
      if (ahead.x > part.x) rect(context, x + inset + thickness - taper, top, reach, across, color)
      if (ahead.x < part.x) rect(context, x + inset - reach + taper, top, reach, across, color)
      if (ahead.y > part.y) rect(context, left, y + inset + thickness - taper, across, reach, color)
      if (ahead.y < part.y) rect(context, left, y + inset - reach + taper, across, reach, color)
      if (!flashing)
        rect(context, x + inset + 1, y + inset + 1, unit(2), 1, 'rgb(255 255 255 / 30%)')
      if (Math.abs(index - pulse) < 1)
        rect(context, x + inset, y + inset, thickness, thickness, 'rgb(255 255 255 / 30%)')
    }
    const head: Point = this.#body[0]!
    const headX: number = boardX + head.x * cell
    const headY: number = boardY + head.y * cell
    // The head is a full square, a little wider than the body, so it leads clearly.
    rect(context, headX, headY, cell - 1, cell - 1, flashing ? INK : (this.#colors[0] ?? BRAND))
    if (!this.#dead && this.#tick % 50 < 8) this.#drawTongue(context, headX, headY, unit)
    this.#drawFace(context, headX, headY, unit)

    for (const spark of this.#sparks) {
      rect(context, spark.x, spark.y, 1, 1, spark.color)
    }
    context.restore()
    if (this.#shake > 6) rect(context, 0, 0, stage.width, stage.height, 'rgb(255 247 214 / 18%)')

    for (const popup of this.#popups) {
      text(context, popup.label, popup.x, popup.y - popup.age / 2 - 6, popup.color, {
        align: 'center',
      })
    }
  }

  /** A forked red tongue that flicks out of the front of the head now and then. */
  #drawTongue(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    unit: (value: number) => number,
  ): void {
    const size: number = this.#cell - 1
    const middle: number = Math.floor(size / 2)
    const length: number = unit(2)
    const fork: number = Math.max(1, unit(1))
    const { x: dx, y: dy } = this.#direction
    const red: string = '#ef4444'
    if (dx !== 0) {
      const base: number = dx > 0 ? x + size : x - length
      rect(context, base, y + middle, length, 1, red)
      const tip: number = dx > 0 ? base + length : base - 1
      rect(context, tip, y + middle - fork, 1, fork, red)
      rect(context, tip, y + middle + 1, 1, fork, red)
    } else {
      const base: number = dy > 0 ? y + size : y - length
      rect(context, x + middle, base, 1, length, red)
      const tip: number = dy > 0 ? base + length : base - 1
      rect(context, x + middle - fork, tip, fork, 1, red)
      rect(context, x + middle + 1, tip, fork, 1, red)
    }
  }

  #drawFace(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    unit: (value: number) => number,
  ): void {
    const eye: string = NIGHT
    const size: number = unit(2)
    const near: number = unit(1)
    const far: number = this.#cell - 1 - near - size
    const { x: dx, y: dy } = this.#direction
    // Two eyes on the leading edge of the head.
    const eyes: readonly Point[] =
      dx !== 0
        ? [
            { x: dx > 0 ? far : near, y: near },
            { x: dx > 0 ? far : near, y: far },
          ]
        : [
            { x: near, y: dy > 0 ? far : near },
            { x: far, y: dy > 0 ? far : near },
          ]
    for (const spot of eyes) {
      if (this.#dead) {
        rect(context, x + spot.x, y + spot.y, 1, 1, eye)
        rect(context, x + spot.x + 1, y + spot.y + 1, 1, 1, eye)
        rect(context, x + spot.x + 1, y + spot.y, 1, 1, DIM)
      } else {
        const pupil: number = Math.max(1, Math.floor(size / 2))
        rect(context, x + spot.x, y + spot.y, size, size, INK)
        rect(
          context,
          x + spot.x + (dx > 0 ? size - pupil : 0),
          y + spot.y + (dy > 0 ? size - pupil : 0),
          pupil,
          pupil,
          eye,
        )
      }
    }
  }
}

export const SNAKE: GameDefinition = {
  id: 'snake',
  keys: [
    { action: 'up', label: 'UP' },
    { action: 'down', label: 'DOWN' },
    { action: 'left', label: 'LEFT' },
    { action: 'right', label: 'RIGHT' },
  ],
  pauseKey: { action: 'back', label: 'PAUSE' },
  pauseActions: ['back'],
  create: (sound: Sound, best: number): Game => new SnakeGame(sound, best),
  drawPreview(context, x, y, width, height, frame): void {
    rect(context, x, y, width, height, '#0b0d14')
    // A short snake circling a file.
    const centerX: number = x + width / 2
    const centerY: number = y + height / 2
    const path: Point[] = []
    const radiusX: number = 5
    const radiusY: number = 2
    for (let step: number = 0; step < radiusX * 2; step += 1)
      path.push({ x: step - radiusX, y: -radiusY })
    for (let step: number = 0; step < radiusY * 2; step += 1)
      path.push({ x: radiusX, y: step - radiusY })
    for (let step: number = 0; step < radiusX * 2; step += 1)
      path.push({ x: radiusX - step, y: radiusY })
    for (let step: number = 0; step < radiusY * 2; step += 1)
      path.push({ x: -radiusX, y: radiusY - step })
    const position: number = Math.floor(frame / 6)
    const cell: number = 5
    for (let segment: number = 7; segment >= 0; segment -= 1) {
      const point: Point = path[(position - segment + path.length * 4) % path.length]!
      rect(
        context,
        centerX + point.x * cell - 2,
        centerY + point.y * cell - 2,
        cell - 1,
        cell - 1,
        BOUNCE_COLORS[segment % BOUNCE_COLORS.length] ?? BRAND,
      )
    }
    draw(
      context,
      fileSprite(BOUNCE_COLORS[Math.floor(frame / 90) % 7] ?? BRAND),
      centerX - 3,
      centerY - 4,
    )
  },
}
