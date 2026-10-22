import type { ShooterSection } from '../../lib/booth'
import { getSettings } from '../../lib/boothStore'
import type { Sound } from '../audio'
import type { InputFrame } from '../input'
import { GOLD, INK, MUTED, clockColor, pad, rect, stage, text, textWidth } from '../pixel'
import {
  STREET_HEIGHT,
  drawCab,
  drawCity,
  drawLifeCab,
  drawPest,
  drawPizzaRat,
  type Pest,
} from './nyc'
import type { Game, GameDefinition, Hud } from './types'

// Bodega Blaster: a Galaga-style shooter. A yellow cab holds the street while pigeons, pizza slices,
// rats, and roaches fly in, sway in formation, and peel off to dive at it. Clear the formation
// for the next, faster wave. Pizza Rat scurries across the top now and then for a bonus.

const HUD_HEIGHT: number = 11
/** Formation rows, top to bottom. */
const ROWS: readonly Pest[] = ['pigeon', 'pizza', 'rat', 'roach']
/**
 * Pests per row on a wide screen: a pyramid like Galaga's formation, narrow on top and widest
 * at the bottom. Narrower screens drop columns from every row.
 */
const ROW_SIZES: readonly number[] = [6, 8, 10, 10]
const MAX_COLUMNS: number = 10
const POINTS: Record<Pest, number> = { pigeon: 40, pizza: 30, rat: 20, roach: 10 }
const SPACING: number = 22
const ROW_GAP: number = 15
/** Center of the top formation row, leaving room above it for Pizza Rat. */
const FORMATION_TOP: number = HUD_HEIGHT + 22
const PIZZA_RAT_Y: number = HUD_HEIGHT + 8
const PLAYER_SPEED: number = 1.7
const SHOT_SPEED: number = 4.5
/** Shots allowed on screen at once, as in Galaga. */
const MAX_SHOTS: number = 2
const FIRE_COOLDOWN: number = 12
const ENEMY_SHOT_SPEED: number = 1.5
/** Ticks for a new wave to fly down into place. */
const ENTRY_TICKS: number = 80
const RESPAWN_TICKS: number = 90
/** Ticks a new cab can't be hit, while it blinks. */
const SHIELD_TICKS: number = 120
const GAME_OVER_TICKS: number = 100
const WAVE_CLEAR_TICKS: number = 90
const WAVE_BONUS: number = 100
const PIZZA_RAT_EVERY: number = 1200
const PIZZA_RAT_POINTS: number = 300
/** Ticks a diver swings out sideways before it heads for the cab. */
const SWING_TICKS: number = 24

type EnemyState = 'formation' | 'diving' | 'returning'

interface Enemy {
  pest: Pest
  row: number
  col: number
  seed: number
  alive: boolean
  state: EnemyState
  x: number
  y: number
  vy: number
  /** Which way a diver swings out first. */
  dir: 1 | -1
  diveTicks: number
  targetX: number
  shotsLeft: number
}

interface Shot {
  x: number
  y: number
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

const SPARK_COLORS: Record<Pest, readonly string[]> = {
  pigeon: ['#d7dbe6', '#2fbf86', '#ffffff'],
  pizza: ['#ffd21a', '#e02424', '#e0a055'],
  rat: ['#8f879c', '#ff8fa3', '#ffffff'],
  roach: ['#b5652a', '#d39a66', '#ffffff'],
}

const clamp = (value: number, limit: number): number => Math.max(-limit, Math.min(limit, value))

class ShooterGame implements Game {
  score: number = 0
  over: boolean = false
  #sound: Sound
  #best: number
  #ticks: number = 0
  #wave: number = 1
  /** Ticks since the current wave started. */
  #waveAge: number = 0
  /** Ticks since the wave was cleared, or 0 while it is still being fought. */
  #clearedFor: number = 0
  #enemies: Enemy[] = []
  readonly #cols: number
  #playerX: number
  #lives: number
  /** Ticks since the cab was hit, or 0 while it is driving. */
  #downFor: number = 0
  #shieldFor: number = 0
  #shots: Shot[] = []
  #enemyShots: Shot[] = []
  #fireCooldown: number = 0
  #untilDive: number = 0
  #untilFire: number = 0
  #pizzaRat: { x: number; dir: 1 | -1 } | null = null
  #untilPizzaRat: number = PIZZA_RAT_EVERY
  #hits: number = 0
  #pizzaRats: number = 0
  #sparks: Spark[] = []
  #popups: Popup[] = []

  constructor(sound: Sound, best: number) {
    this.#sound = sound
    this.#best = best
    const settings: ShooterSection = getSettings().shooter
    this.#lives = settings.lives
    this.#playerX = stage.width / 2
    this.#cols = Math.max(5, Math.min(MAX_COLUMNS, Math.floor((stage.width - 24) / SPACING)))
    this.#startWave(1)
  }

  endTitle(endedBy: 'game over' | 'time'): string {
    // A cab's roof sign says OFF DUTY when it's done for the night.
    return endedBy === 'time' ? "I'M WALKIN' HERE!" : 'OFF DUTY!'
  }

  get summary(): string {
    const parts: string[] = [`WAVE ${this.#wave}`, `${this.#hits} PESTS`]
    if (this.#pizzaRats > 0)
      parts.push(`${this.#pizzaRats} PIZZA RAT${this.#pizzaRats > 1 ? 'S' : ''}`)
    while (parts.length > 1 && textWidth(parts.join(' · ')) > stage.width - 8) parts.pop()
    return parts.join(' · ')
  }

  /** How much faster this wave dives and fires than the first. */
  #pace(settings: ShooterSection): number {
    return 1 + (settings.waveRamp / 100) * (this.#wave - 1)
  }

  /** The cab drives on the street itself, which leaves the most sky between it and the pests. */
  get #playerY(): number {
    return stage.height - 12
  }

  #startWave(wave: number): void {
    const settings: ShooterSection = getSettings().shooter
    this.#wave = wave
    this.#waveAge = 0
    this.#clearedFor = 0
    this.#enemyShots = []
    this.#enemies = []
    ROWS.forEach((pest: Pest, row: number): void => {
      // Every row is centered on the same grid, so a row of 6 lines up under a row of 10.
      let size: number = Math.min(ROW_SIZES[row] ?? this.#cols, this.#cols)
      if ((this.#cols - size) % 2 !== 0) size -= 1
      const first: number = (this.#cols - size) / 2
      for (let col: number = first; col < first + size; col += 1) {
        const enemy: Enemy = {
          pest,
          row,
          col,
          seed: row * 3 + col,
          alive: true,
          state: 'formation',
          x: 0,
          y: 0,
          vy: 0,
          dir: 1,
          diveTicks: 0,
          targetX: 0,
          shotsLeft: 0,
        }
        Object.assign(enemy, this.#slot(enemy))
        this.#enemies.push(enemy)
      }
    })
    this.#untilDive = this.#diveDelay(settings)
    this.#untilFire = this.#fireDelay(settings)
  }

  #diveDelay(settings: ShooterSection): number {
    return ((settings.diveEvery * 60) / this.#pace(settings)) * (0.7 + Math.random() * 0.6)
  }

  #fireDelay(settings: ShooterSection): number {
    if (settings.enemyFire <= 0) return Number.POSITIVE_INFINITY
    return (60 / (settings.enemyFire * this.#pace(settings))) * (0.6 + Math.random() * 0.8)
  }

  /** Where an enemy sits in the formation right now: swaying, and flying in at the start. */
  #slot(enemy: Enemy): { x: number; y: number } {
    const room: number = (stage.width - this.#cols * SPACING) / 2 - 6
    const sway: number = Math.round(Math.sin(this.#ticks / 70) * Math.max(0, Math.min(10, room)))
    const entering: number =
      this.#waveAge < ENTRY_TICKS ? Math.round((1 - this.#waveAge / ENTRY_TICKS) ** 2 * 90) : 0
    return {
      x: stage.width / 2 + (enemy.col - (this.#cols - 1) / 2) * SPACING + sway,
      y: FORMATION_TOP + enemy.row * ROW_GAP - entering,
    }
  }

  #burst(x: number, y: number, colors: readonly string[], count: number): void {
    for (let index: number = 0; index < count; index += 1) {
      const angle: number = (index / count) * Math.PI * 2 + Math.random() * 0.4
      const speed: number = 0.7 + Math.random() * 1.4
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
    this.#waveAge += 1
    for (const spark of this.#sparks) {
      spark.x += spark.dx
      spark.y += spark.dy
      spark.dy += 0.04
      spark.age += 1
    }
    this.#sparks = this.#sparks.filter((spark: Spark): boolean => spark.age < 26)
    this.#popups = this.#popups.filter((popup: Popup): boolean => (popup.age += 1) < 50)
    if (this.over) return

    // Difficulty comes from the admin window and applies live.
    const settings: ShooterSection = getSettings().shooter
    const width: number = stage.width
    const height: number = stage.height

    if (this.#downFor > 0) {
      this.#downFor += 1
      if (this.#lives === 0) {
        if (this.#downFor > GAME_OVER_TICKS) this.over = true
      } else if (this.#downFor > RESPAWN_TICKS) {
        this.#downFor = 0
        this.#shieldFor = SHIELD_TICKS
        this.#playerX = width / 2
      }
    }
    const driving: boolean = this.#downFor === 0

    // The cab: steer, and fire. Tapping fires as fast as you can tap; holding keeps firing.
    if (driving) {
      if (input.held.has('left')) this.#playerX -= PLAYER_SPEED
      if (input.held.has('right')) this.#playerX += PLAYER_SPEED
      this.#playerX = Math.max(8, Math.min(width - 8, this.#playerX))
      if (this.#fireCooldown > 0) this.#fireCooldown -= 1
      const wantsFire: boolean =
        input.pressed('fire') || (input.held.has('fire') && this.#fireCooldown === 0)
      if (wantsFire && this.#shots.length < MAX_SHOTS) {
        this.#shots.push({ x: this.#playerX, y: this.#playerY - 10 })
        this.#fireCooldown = FIRE_COOLDOWN
        this.#sound.play('shoot')
      }
      if (this.#shieldFor > 0) this.#shieldFor -= 1
    }

    // Pizza Rat scurries across the top every so often.
    const fighting: boolean = this.#waveAge >= ENTRY_TICKS && this.#clearedFor === 0
    if (fighting && !this.#pizzaRat) {
      this.#untilPizzaRat -= 1
      if (this.#untilPizzaRat <= 0) {
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
        this.#pizzaRat = { x: dir > 0 ? -14 : width + 14, dir }
        this.#untilPizzaRat = PIZZA_RAT_EVERY
      }
    }
    if (this.#pizzaRat) {
      this.#pizzaRat.x += this.#pizzaRat.dir * 0.8
      if (this.#pizzaRat.x < -20 || this.#pizzaRat.x > width + 20) this.#pizzaRat = null
    }

    this.#moveShots()

    // Dives and formation fire start once the wave is in place.
    if (fighting) {
      this.#untilDive -= 1
      if (this.#untilDive <= 0) {
        this.#sendDivers()
        this.#untilDive = this.#diveDelay(settings)
      }
      this.#untilFire -= 1
      if (this.#untilFire <= 0) {
        if (driving) this.#formationFire()
        this.#untilFire = this.#fireDelay(settings)
      }
    }
    this.#moveEnemies(settings, driving)

    for (const shot of this.#enemyShots) shot.y += ENEMY_SHOT_SPEED
    this.#enemyShots = this.#enemyShots.filter((shot: Shot): boolean => shot.y < height)
    if (driving && this.#shieldFor === 0) {
      const top: number = this.#playerY - 9
      const bottom: number = this.#playerY + 9
      const hit: boolean = this.#enemyShots.some(
        (shot: Shot): boolean =>
          Math.abs(shot.x - this.#playerX) < 6 && shot.y + 4 > top && shot.y < bottom,
      )
      if (hit) this.#hitCab()
    }

    // A cleared wave earns a bonus, then the next one flies in faster.
    if (this.#clearedFor === 0 && this.#enemies.every((enemy: Enemy): boolean => !enemy.alive)) {
      this.#clearedFor = 1
      const bonus: number = WAVE_BONUS * this.#wave
      this.score += bonus
      this.#popup(width / 2, height / 2 + 14, `+${bonus}`)
      this.#sound.play('bonus')
    } else if (this.#clearedFor > 0) {
      this.#clearedFor += 1
      if (this.#clearedFor > WAVE_CLEAR_TICKS) this.#startWave(this.#wave + 1)
    }
  }

  #moveShots(): void {
    for (const shot of this.#shots) shot.y -= SHOT_SPEED
    this.#shots = this.#shots.filter((shot: Shot): boolean => {
      if (shot.y < HUD_HEIGHT) return false
      if (
        this.#pizzaRat &&
        Math.abs(shot.x - (this.#pizzaRat.x - this.#pizzaRat.dir * 6)) < 14 &&
        Math.abs(shot.y - PIZZA_RAT_Y) < 8
      ) {
        this.score += PIZZA_RAT_POINTS
        this.#pizzaRats += 1
        this.#burst(this.#pizzaRat.x, PIZZA_RAT_Y, ['#ffd21a', '#ff8fa3', '#e02424', '#ffffff'], 26)
        this.#popup(this.#pizzaRat.x, PIZZA_RAT_Y, `PIZZA RAT! ${PIZZA_RAT_POINTS}`)
        this.#sound.play('bonus')
        this.#pizzaRat = null
        return false
      }
      for (const enemy of this.#enemies) {
        if (!enemy.alive) continue
        if (Math.abs(shot.x - enemy.x) < 7 && Math.abs(shot.y - enemy.y) < 7) {
          enemy.alive = false
          this.#hits += 1
          // Divers are worth double, as in Galaga.
          const points: number = POINTS[enemy.pest] * (enemy.state === 'formation' ? 1 : 2)
          this.score += points
          this.#burst(enemy.x, enemy.y, SPARK_COLORS[enemy.pest], 14)
          if (enemy.state !== 'formation') this.#popup(enemy.x, enemy.y, `+${points}`)
          this.#sound.play('explode')
          return false
        }
      }
      return true
    })
  }

  #sendDivers(): void {
    const waiting: Enemy[] = this.#enemies.filter(
      (enemy: Enemy): boolean => enemy.alive && enemy.state === 'formation',
    )
    const first: Enemy | undefined = waiting[Math.floor(Math.random() * waiting.length)]
    if (!first) return
    const divers: Enemy[] = [first]
    // From the second wave, a wingman sometimes dives alongside.
    if (this.#wave > 1 && Math.random() < 0.4) {
      const wingman: Enemy | undefined = waiting.find(
        (enemy: Enemy): boolean => enemy.row === first.row && Math.abs(enemy.col - first.col) === 1,
      )
      if (wingman) divers.push(wingman)
    }
    for (const enemy of divers) {
      enemy.state = 'diving'
      enemy.diveTicks = 0
      enemy.vy = 0
      enemy.dir = enemy.col < this.#cols / 2 ? -1 : 1
      enemy.shotsLeft = this.#wave > 2 ? 2 : 1
    }
    this.#sound.play('dive')
  }

  /** The lowest enemy in a random column fires, so shots never pass through the formation. */
  #formationFire(): void {
    const shooters: Enemy[] = []
    for (let col: number = 0; col < this.#cols; col += 1) {
      const lowest: Enemy | undefined = this.#enemies
        .filter(
          (enemy: Enemy): boolean =>
            enemy.alive && enemy.state === 'formation' && enemy.col === col,
        )
        .sort((a: Enemy, b: Enemy): number => b.row - a.row)[0]
      if (lowest) shooters.push(lowest)
    }
    const shooter: Enemy | undefined = shooters[Math.floor(Math.random() * shooters.length)]
    if (shooter) this.#enemyShots.push({ x: shooter.x, y: shooter.y + 7 })
  }

  #moveEnemies(settings: ShooterSection, driving: boolean): void {
    const height: number = stage.height
    const pace: number = this.#pace(settings)
    for (const enemy of this.#enemies) {
      if (!enemy.alive) continue
      const slot: { x: number; y: number } = this.#slot(enemy)
      if (enemy.state === 'formation') {
        enemy.x = slot.x
        enemy.y = slot.y
        continue
      }
      if (enemy.state === 'diving') {
        enemy.diveTicks += 1
        if (enemy.diveTicks < SWING_TICKS) {
          // Swing up and out of the formation first.
          enemy.x += enemy.dir * 1.1
          enemy.y -= 0.5
        } else {
          if (enemy.diveTicks === SWING_TICKS) enemy.targetX = this.#playerX
          enemy.vy = Math.min(enemy.vy + 0.05, 1.6 * settings.diveSpeed * Math.sqrt(pace))
          enemy.y += enemy.vy
          enemy.x += clamp(enemy.targetX - enemy.x, 0.8 * settings.diveSpeed)
          const midway: boolean = enemy.y > height * 0.35 && enemy.y < height * 0.7
          if (driving && enemy.shotsLeft > 0 && midway && Math.random() < 0.025 * pace) {
            this.#enemyShots.push({ x: enemy.x, y: enemy.y + 7 })
            enemy.shotsLeft -= 1
          }
        }
        // Off the bottom: fly back in from the top to its place.
        if (enemy.y > height + 10) {
          enemy.y = -10
          enemy.state = 'returning'
        }
      } else {
        enemy.x += clamp(slot.x - enemy.x, 1.6)
        enemy.y += clamp(slot.y - enemy.y, 1.6)
        if (Math.abs(slot.x - enemy.x) < 1.6 && Math.abs(slot.y - enemy.y) < 1.6)
          enemy.state = 'formation'
      }
      // A diver that rams the cab takes it out, and goes down with it.
      if (
        driving &&
        this.#shieldFor === 0 &&
        Math.abs(enemy.x - this.#playerX) < 9 &&
        Math.abs(enemy.y - this.#playerY) < 12
      ) {
        enemy.alive = false
        this.#burst(enemy.x, enemy.y, SPARK_COLORS[enemy.pest], 10)
        this.#hitCab()
        return
      }
    }
  }

  #hitCab(): void {
    this.#lives -= 1
    this.#downFor = 1
    this.#shots = []
    this.#enemyShots = []
    this.#burst(this.#playerX, this.#playerY, ['#ffd21a', '#ff6319', '#ffffff', '#ff3030'], 30)
    this.#sound.play('crash')
    // Everyone diving heads home while the next cab pulls up.
    for (const enemy of this.#enemies) if (enemy.state === 'diving') enemy.state = 'returning'
  }

  draw(context: CanvasRenderingContext2D, hud: Hud): void {
    const width: number = stage.width
    const height: number = stage.height
    drawCity(context, width, height)

    // Status bar
    rect(context, 0, 0, width, HUD_HEIGHT, '#03040c')
    text(context, `SCORE ${pad(this.score, 4)}`, 6, 2, INK)
    if (hud.secondsLeft === null) {
      text(context, `WAVE ${this.#wave}`, width / 2, 2, MUTED, { align: 'center' })
    } else {
      text(context, `TIME ${hud.secondsLeft}`, width / 2, 2, clockColor(hud.secondsLeft), {
        align: 'center',
      })
    }
    text(context, `BEST ${pad(Math.max(this.#best, this.score), 4)}`, width - 6, 2, MUTED, {
      align: 'right',
    })

    if (this.#pizzaRat) {
      drawPizzaRat(context, this.#pizzaRat.x, PIZZA_RAT_Y, this.#pizzaRat.dir, this.#ticks)
    }
    for (const enemy of this.#enemies) {
      if (enemy.alive) drawPest(context, enemy.pest, enemy.x, enemy.y, this.#ticks, enemy.seed)
    }

    // Shots carry a black outline, like the sprites, so they stay sharp on a CRT.
    for (const shot of this.#enemyShots) {
      rect(context, shot.x - 2, shot.y - 1, 4, 6, '#000000')
      rect(context, shot.x - 1, shot.y, 2, 4, '#ff5a3c')
    }
    for (const shot of this.#shots) {
      rect(context, shot.x - 2, shot.y - 1, 4, 8, '#000000')
      rect(context, shot.x - 1, shot.y, 2, 6, '#fff3a0')
    }

    // Spare cabs wait at the curb.
    for (let index: number = 0; index < Math.max(0, this.#lives - 1); index += 1) {
      drawLifeCab(context, 4 + index * 10, height - STREET_HEIGHT)
    }
    const blinking: boolean = this.#shieldFor > 0 && Math.floor(this.#shieldFor / 4) % 2 === 0
    if (this.#downFor === 0 && !blinking) drawCab(context, this.#playerX, this.#playerY)

    for (const spark of this.#sparks) rect(context, spark.x, spark.y, 1, 1, spark.color)
    for (const popup of this.#popups) {
      text(context, popup.label, popup.x, popup.y - popup.age / 3 - 6, popup.color, {
        align: 'center',
      })
    }

    const middle: number = Math.round(height / 2)
    if (this.#clearedFor > 0) {
      text(context, `WAVE ${this.#wave} CLEAR`, width / 2, middle - 8, GOLD, {
        scale: 2,
        align: 'center',
        maxWidth: width - 8,
      })
    } else if (this.#waveAge < ENTRY_TICKS + 30) {
      text(context, `WAVE ${this.#wave}`, width / 2, middle - 8, INK, { scale: 2, align: 'center' })
    }
    if (this.#downFor > 30 && this.#lives > 0) {
      text(context, 'READY', width / 2, middle + 12, INK, { align: 'center' })
    }
  }
}

export const SHOOTER: GameDefinition = {
  id: 'shooter',
  keys: [
    { action: 'left', label: 'LEFT' },
    { action: 'right', label: 'RIGHT' },
    { action: 'fire', label: 'FIRE' },
  ],
  pauseKey: { action: 'back', label: 'PAUSE' },
  pauseActions: ['back'],
  create: (sound: Sound, best: number): Game => new ShooterGame(sound, best),
  drawPreview(context, x, y, width, height, frame): void {
    // A row of pests swaying over the city while the cab slides back and forth, firing.
    context.save()
    context.translate(x, y)
    drawCity(context, width, height)
    const sway: number = Math.round(Math.sin(frame / 40) * 6)
    ROWS.forEach((pest: Pest, index: number): void => {
      drawPest(
        context,
        pest,
        width / 2 + (index - 1.5) * 20 + sway,
        14 + (index % 2) * 4,
        frame,
        index,
      )
    })
    const cabX: number = width / 2 + Math.round(Math.sin(frame / 55) * (width / 2 - 14))
    const cabY: number = height - 12
    const shotAge: number = frame % 40
    const shotY: number = cabY - 10 - shotAge * 3
    if (shotY > 20) {
      rect(context, cabX - 2, shotY - 1, 4, 8, '#000000')
      rect(context, cabX - 1, shotY, 2, 6, '#fff3a0')
    }
    drawCab(context, cabX, cabY)
    context.restore()
  },
}
