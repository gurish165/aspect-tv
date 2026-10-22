import {
  JETPACK_PRESETS,
  RUNNER_PRESETS,
  SHOOTER_PRESETS,
  SNAKE_PRESETS,
  matchingPreset,
  type ArcadeSection,
  type BoothSettings,
} from '../lib/booth'
import { getSettings, updateSettings } from '../lib/boothStore'
import { BOUNCE_COLORS } from '../lib/bounce'
import { MAX_VOLUME, type Sound } from './audio'
import { JETPACK } from './games/jetpack'
import { RUNNER } from './games/runner'
import { SHOOTER } from './games/shooter'
import { SNAKE } from './games/snake'
import type { Game, GameDefinition, Hud, KeyHint } from './games/types'
import { type Action, type InputFrame, actionKey, keypadLabels } from './input'
import {
  BRAND,
  BRAND_DEEP,
  DANGER,
  DIM,
  EDGE,
  GOLD,
  INK,
  MUTED,
  NIGHT,
  PANEL,
  blink,
  column,
  ellipse,
  fittedScale,
  outline,
  pad,
  rect,
  stage,
  text,
  textWidth,
} from './pixel'
import { TAPE_HEIGHT, brandBox, drawBrand, drawNeonScene, drawTape, type Box } from './home'
import { REWARD_TIERS, SHOW_CREDITS, rewardFor, type RewardResult } from './rewards'
import {
  BOARD_SIZE,
  addScore,
  bestScore,
  rankFor,
  recordPlay,
  topScores,
  type EndReason,
  type ScoreEntry,
} from './scores'

export const TICKS_PER_SECOND: number = 60
const seconds = (value: number): number => value * TICKS_PER_SECOND

// How long each screen waits for input before giving up and returning to the attract screen.
// The reward screen's wait is a setting.
const SELECT_TIMEOUT: number = seconds(30)
const PAUSE_TIMEOUT: number = seconds(45)
const INITIALS_TIMEOUT: number = seconds(45)
/** How long the directions screen shows before the game starts on its own. */
const COUNTDOWN: number = seconds(10)
const GAME_OVER_LOCK: number = seconds(1.5)
const GAME_OVER_AUTO: number = seconds(6)
const REWARD_LOCK: number = seconds(2)
const WARNING: number = seconds(10)
interface KeyPrompt {
  /** Actions whose keys are drawn as keycaps; each shows its first bound key. */
  keys: readonly Action[]
  label: string
}

/** Height of a keypad keycap drawn on screen. */
const KEYCAP: number = 11
/** The initials row: an "8" keycap, the letters, and a "2" keycap. */
const LETTERS_BLOCK: number = KEYCAP * 2 + 3 + 21 + 7
/** Layers of the headline's 3D extrusion, in arcade pixels. */
const HEADLINE_DEPTH: number = 3
const LEADERBOARD_TIMEOUT: number = seconds(30)
/** In corner mode, the home screen shows today's top 10 for a while every so often. */
const ATTRACT_LOOP: number = seconds(20)
const AUTO_LEADERBOARD: number = seconds(8)

const GAMES: readonly GameDefinition[] = [SNAKE, RUNNER, SHOOTER, JETPACK]
const LETTERS: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const DIRECTIONS: readonly Action[] = ['up', 'down', 'left', 'right']
const GLYPH_HEIGHT: number = 7

export type Screen =
  | 'attract'
  | 'leaderboard'
  | 'select'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'gameOver'
  | 'initials'
  | 'reward'

interface Finish {
  definition: GameDefinition
  title: string
  score: number
  reward: RewardResult
  rank: number | null
  initials: string | null
  /** The claim code, once the play is logged. */
  code: string | null
  endedBy: EndReason
  durationSeconds: number
  /** The game's own game-over title and summary line, if it has them. */
  headline: string | null
  summary: string | null
}

interface Confetti {
  x: number
  y: number
  speed: number
  drift: number
  color: string
}

function gameTitle(definition: GameDefinition, settings: BoothSettings = getSettings()): string {
  return settings[definition.id].title
}

function difficultyName(definition: GameDefinition, settings: BoothSettings): string {
  switch (definition.id) {
    case 'snake':
      return matchingPreset(SNAKE_PRESETS, settings.snake)
    case 'runner':
      return matchingPreset(RUNNER_PRESETS, settings.runner)
    case 'shooter':
      return matchingPreset(SHOOTER_PRESETS, settings.shooter)
    case 'jetpack':
      return matchingPreset(JETPACK_PRESETS, settings.jetpack)
  }
}

/** The long hint when it fits the screen, otherwise the short one. */
function hint(
  context: CanvasRenderingContext2D,
  long: string,
  short: string,
  y: number,
  color: string = MUTED,
): void {
  const value: string = textWidth(long) <= stage.width - 8 ? long : short
  text(context, value, stage.width / 2, y, color, { align: 'center' })
}

export class Arcade {
  #sound: Sound
  #screen: Screen = 'attract'
  /** Ticks since the screen changed. */
  #age: number = 0
  /** Ticks since the last key press on this screen. */
  #quiet: number = 0
  #frame: number = 0
  #selected: number = 0
  #game: Game | null = null
  #playTicks: number = 0
  #finish: Finish | null = null
  #letters: number[] = [0, 0, 0]
  #slot: number = 0
  /** When each key was last pressed on the initials screen, so its keycap can flash. */
  #keyPressedAt: Map<Action, number> = new Map()
  #volumeShownFor: number = 0
  #confetti: Confetti[] = []
  /** True when the leaderboard came up on its own, rather than from Tab. */
  #autoBoard: boolean = false

  constructor(sound: Sound) {
    this.#sound = sound
  }

  get screen(): Screen {
    return this.#screen
  }

  get #definition(): GameDefinition {
    return GAMES[this.#selected] ?? SNAKE
  }

  #go(screen: Screen): void {
    this.#screen = screen
    this.#age = 0
    this.#quiet = 0
  }

  #toAttract(): void {
    this.#game = null
    this.#finish = null
    this.#go('attract')
  }

  /** Pauses a game in progress, for example when the TV window loses the keypad. */
  suspend(): void {
    if (this.#screen !== 'playing') return
    this.#sound.play('pause')
    this.#go('paused')
  }

  step(input: InputFrame): void {
    this.#frame += 1
    this.#age += 1
    this.#quiet = input.presses.length > 0 ? 0 : this.#quiet + 1
    if (this.#volumeShownFor > 0) this.#volumeShownFor -= 1
    const arcade: ArcadeSection = getSettings().arcade
    for (const action of input.presses) this.#keyPressedAt.set(action, this.#frame)
    for (const action of input.presses) {
      if ((action === 'volumeUp' || action === 'volumeDown') && arcade.keypadVolume) {
        const step: number = action === 'volumeUp' ? 1 : -1
        const volume: number = Math.max(0, Math.min(MAX_VOLUME, arcade.volume + step))
        updateSettings({ arcade: { volume } })
        this.#volumeShownFor = seconds(1.5)
        this.#sound.play('move')
      }
    }

    switch (this.#screen) {
      case 'attract':
        return this.#stepAttract(input)
      case 'leaderboard':
        return this.#stepLeaderboard(input)
      case 'select':
        return this.#stepSelect(input)
      case 'ready':
        return this.#stepReady(input)
      case 'playing':
        return this.#stepPlaying(input)
      case 'paused':
        return this.#stepPaused(input)
      case 'gameOver':
        return this.#stepGameOver(input)
      case 'initials':
        return this.#stepInitials(input)
      case 'reward':
        return this.#stepReward(input)
    }
  }

  #starts(input: InputFrame): boolean {
    return input.presses.some(
      (action: Action): boolean =>
        action === 'confirm' || action === 'jump' || DIRECTIONS.includes(action),
    )
  }

  #stepAttract(input: InputFrame): void {
    if (input.pressed('leaderboard')) {
      this.#sound.play('select')
      this.#autoBoard = false
      this.#go('leaderboard')
      return
    }
    if (this.#starts(input)) {
      this.#sound.play('start')
      this.#go('select')
      return
    }
    const hasScores: boolean = GAMES.some(
      (definition: GameDefinition): boolean => topScores(definition.id, 1).length > 0,
    )
    if (getSettings().display.mode === 'corner' && hasScores && this.#age > ATTRACT_LOOP) {
      this.#autoBoard = true
      this.#go('leaderboard')
    }
  }

  #stepLeaderboard(input: InputFrame): void {
    // Tab on a board that came up on its own keeps it up, like opening it by hand.
    if (input.pressed('leaderboard') && this.#autoBoard) {
      this.#autoBoard = false
      this.#quiet = 0
      return
    }
    // Any key that would start a game, plus Tab and Back, goes back to the home screen.
    const leaves: boolean =
      this.#starts(input) || input.pressed('leaderboard') || input.pressed('back')
    if (leaves) this.#sound.play('back')
    const limit: number = this.#autoBoard ? AUTO_LEADERBOARD : LEADERBOARD_TIMEOUT
    if (leaves || this.#quiet > limit) this.#go('attract')
  }

  #stepSelect(input: InputFrame): void {
    for (const action of input.presses) {
      if (action === 'left' || action === 'up' || action === 'right' || action === 'down') {
        const step: number = action === 'left' || action === 'up' ? -1 : 1
        this.#selected = (this.#selected + step + GAMES.length) % GAMES.length
        this.#sound.play('move')
      } else if (action === 'confirm') {
        this.#sound.play('select')
        this.#game = this.#definition.create(this.#sound, bestScore(this.#definition.id))
        this.#go('ready')
        return
      } else if (action === 'back') {
        this.#sound.play('back')
        this.#toAttract()
        return
      }
    }
    if (this.#quiet > SELECT_TIMEOUT) this.#toAttract()
  }

  #stepReady(input: InputFrame): void {
    if (input.pressed('back')) {
      this.#sound.play('back')
      this.#game = null
      this.#go('select')
      return
    }
    // Let a ready player skip the countdown, but not by mashing the key that picked the game.
    const skip: boolean = this.#age > seconds(0.6) && input.pressed('confirm')
    const remaining: number = COUNTDOWN - this.#age
    if (remaining > 0 && remaining % seconds(1) === 0 && remaining <= seconds(3))
      this.#sound.play('count')
    if (skip || remaining <= 0) {
      this.#sound.play('go')
      this.#playTicks = 0
      this.#go('playing')
    }
  }

  /** Whole seconds left on the clock, or null when there is no time limit. */
  #secondsLeft(): number | null {
    const limit: number = getSettings().arcade.timeLimit
    if (limit <= 0) return null
    return Math.max(0, Math.ceil((seconds(limit) - this.#playTicks) / TICKS_PER_SECOND))
  }

  #stepPlaying(input: InputFrame): void {
    const game: Game | null = this.#game
    if (!game) return this.#toAttract()
    if (this.#definition.pauseActions.some((action: Action): boolean => input.pressed(action))) {
      this.#sound.play('pause')
      this.#go('paused')
      return
    }
    this.#playTicks += 1
    game.update(input)
    if (game.over) return this.#end('game over')

    const limit: number = getSettings().arcade.timeLimit
    if (limit <= 0) return
    const left: number = seconds(limit) - this.#playTicks
    if (left <= 0) {
      this.#end('time')
    } else if (left <= seconds(3) && left % seconds(1) === 0) {
      this.#sound.play('count')
    }
  }

  #stepPaused(input: InputFrame): void {
    if (input.pressed('confirm')) {
      this.#sound.play('pause')
      this.#go('playing')
    } else if (input.pressed('back')) {
      this.#end('quit')
    } else if (this.#quiet > PAUSE_TIMEOUT) {
      // Walked away mid-game.
      this.#toAttract()
    }
  }

  #end(endedBy: EndReason): void {
    const definition: GameDefinition = this.#definition
    const score: number = this.#game?.score ?? 0
    this.#finish = {
      definition,
      title: gameTitle(definition),
      score,
      reward: rewardFor(definition.id, score),
      rank: rankFor(definition.id, score),
      initials: null,
      code: null,
      endedBy,
      durationSeconds: Math.round(this.#playTicks / TICKS_PER_SECOND),
      headline: endedBy === 'quit' ? null : (this.#game?.endTitle?.(endedBy) ?? null),
      summary: this.#game?.summary ?? null,
    }
    this.#sound.play(endedBy === 'quit' ? 'back' : 'gameOver')
    this.#go('gameOver')
  }

  #stepGameOver(input: InputFrame): void {
    const finish: Finish | null = this.#finish
    if (!finish) return this.#toAttract()
    const advance: boolean =
      (this.#age > GAME_OVER_LOCK && input.pressed('confirm')) || this.#age > GAME_OVER_AUTO
    if (!advance) return
    if (finish.rank !== null) {
      this.#letters = [0, 0, 0]
      this.#slot = 0
      this.#sound.play('highScore')
      this.#go('initials')
    } else {
      this.#showReward()
    }
  }

  #stepInitials(input: InputFrame): void {
    for (const action of input.presses) {
      const letter: number = this.#letters[this.#slot] ?? 0
      if (action === 'up' || action === 'down') {
        const step: number = action === 'up' ? 1 : -1
        this.#letters[this.#slot] = (letter + step + LETTERS.length) % LETTERS.length
        this.#sound.play('letter')
      } else if (action === 'right' || (action === 'confirm' && this.#slot < 2)) {
        if (action === 'confirm' || this.#slot < 2) this.#sound.play('move')
        this.#slot = Math.min(2, this.#slot + 1)
      } else if (action === 'left' || action === 'back') {
        if (this.#slot > 0) this.#sound.play('move')
        this.#slot = Math.max(0, this.#slot - 1)
      } else if (action === 'confirm') {
        this.#saveInitials()
        return
      }
    }
    if (this.#quiet > INITIALS_TIMEOUT) this.#saveInitials()
  }

  #saveInitials(): void {
    const finish: Finish | null = this.#finish
    if (!finish) return this.#toAttract()
    finish.initials = this.#letters.map((index: number): string => LETTERS[index] ?? 'A').join('')
    addScore(finish.definition.id, finish.initials, finish.score)
    this.#showReward()
  }

  #showReward(): void {
    const finish: Finish | null = this.#finish
    if (!finish) return this.#toAttract()
    const settings: BoothSettings = getSettings()
    this.#sound.play('reward')
    this.#confetti = Array.from({ length: 48 }, (_unused: unknown, index: number): Confetti => ({
      x: Math.random(),
      y: -Math.random() * stage.height,
      speed: 0.4 + Math.random() * 0.8,
      drift: Math.random() * Math.PI * 2,
      color: BOUNCE_COLORS[index % BOUNCE_COLORS.length] ?? BRAND,
    }))
    this.#go('reward')
    void recordPlay({
      game: finish.definition.id,
      score: finish.score,
      tier: finish.reward.tier.name,
      credits: finish.reward.tier.credits,
      initials: finish.initials,
      durationSeconds: finish.durationSeconds,
      endedBy: finish.endedBy,
      difficulty: difficultyName(finish.definition, settings),
      timeLimit: settings.arcade.timeLimit,
      at: new Date().toISOString(),
    }).then((code: string): void => {
      finish.code = code
    })
  }

  #stepReward(input: InputFrame): void {
    for (const piece of this.#confetti) {
      piece.y += piece.speed
      piece.drift += 0.05
      if (piece.y > stage.height) piece.y = -4
    }
    const done: boolean =
      this.#age > REWARD_LOCK && (input.pressed('confirm') || input.pressed('back'))
    if (done) this.#sound.play('select')
    if (done || this.#quiet > seconds(getSettings().arcade.rewardSeconds)) this.#toAttract()
  }

  // Drawing. Every layout reads the stage size, which follows the size and stretch settings.

  draw(context: CanvasRenderingContext2D): void {
    context.clearRect(0, 0, stage.width, stage.height)
    const hud: Hud = { secondsLeft: this.#secondsLeft() }
    switch (this.#screen) {
      case 'attract':
        this.#drawAttract(context)
        break
      case 'leaderboard':
        this.#drawLeaderboard(context)
        break
      case 'select':
        this.#drawSelect(context)
        break
      case 'ready':
        this.#game?.draw(context, hud)
        this.#drawReady(context)
        break
      case 'playing':
        this.#game?.draw(context, hud)
        break
      case 'paused':
        this.#game?.draw(context, hud)
        this.#drawPaused(context)
        break
      case 'gameOver':
        this.#game?.draw(context, hud)
        this.#drawGameOver(context)
        break
      case 'initials':
        this.#drawInitials(context)
        break
      case 'reward':
        this.#drawReward(context)
        break
    }
    if (this.#volumeShownFor > 0) this.#drawVolume(context)
    if (getSettings().screen.testPattern) this.#drawTestPattern(context)
  }

  #dim(context: CanvasRenderingContext2D, alpha: number): void {
    rect(context, 0, 0, stage.width, stage.height, `rgb(7 8 11 / ${Math.round(alpha * 100)}%)`)
  }

  #drawTimeout(context: CanvasRenderingContext2D, limit: number, y: number): boolean {
    const left: number = limit - this.#quiet
    if (left > WARNING) return false
    text(context, `RETURNING IN ${Math.ceil(left / TICKS_PER_SECOND)}`, stage.width / 2, y, GOLD, {
      align: 'center',
    })
    return true
  }

  /** Draws a title at up to the given scale and returns the scale that fit. */
  #title(
    context: CanvasRenderingContext2D,
    value: string,
    y: number,
    color: string,
    scale: number,
  ): number {
    const fitted: number = fittedScale(value, scale, stage.width - 8)
    text(context, value, stage.width / 2, y, color, { scale: fitted, align: 'center' })
    return fitted
  }

  /** The corner-logo home background, with room reserved around the logo. */
  #drawHomeBackground(context: CanvasRenderingContext2D): { top: number; bottom: number } {
    const settings: BoothSettings = getSettings()
    // A little more room above than below sits the group lower on the screen.
    const top: number = TAPE_HEIGHT + 20
    const bottom: number = stage.height - TAPE_HEIGHT - 5
    if (settings.display.mode !== 'corner') return { top, bottom }
    drawNeonScene(context, this.#frame)
    const box: Box = brandBox(settings.display.corner)
    drawBrand(context, this.#frame, box)
    return settings.display.corner.startsWith('top')
      ? { top: Math.max(top, box.y + box.height + 6), bottom }
      : // A bottom corner sits off to the side of the centered button and text.
        { top, bottom }
  }

  /**
   * The home headline, extruded like an arcade marquee, with a wave of the bounce colors running
   * through its letters every few seconds.
   */
  #drawHeadline(context: CanvasRenderingContext2D, value: string, y: number, scale: number): void {
    const characters: string = value.toUpperCase()
    const advance: number = 6 * scale
    const left: number = Math.round(stage.width / 2 - textWidth(characters, scale) / 2)
    const wave: number = (this.#frame % 240) / 3 - 4
    for (let index: number = 0; index < characters.length; index += 1) {
      const character: string = characters[index] ?? ' '
      if (character === ' ') continue
      const x: number = left + index * advance
      // Letters near the wave lift a pixel and take a bounce color.
      const distance: number = Math.abs(index - wave)
      const lit: boolean = distance < 1.5
      const lift: number = lit ? 1 : 0
      for (let depth: number = HEADLINE_DEPTH; depth > 0; depth -= 1) {
        const shade: string = depth === HEADLINE_DEPTH ? '#000000' : depth > 1 ? BRAND_DEEP : BRAND
        text(context, character, x + depth, y + depth - lift, shade, { scale, shadow: false })
      }
      const face: string = lit
        ? (BOUNCE_COLORS[(index + Math.floor(this.#frame / 240)) % BOUNCE_COLORS.length] ?? GOLD)
        : INK
      text(context, character, x, y - lift, face, { scale, shadow: false })
    }
  }

  #drawAttract(context: CanvasRenderingContext2D): void {
    const settings: BoothSettings = getSettings()
    const width: number = stage.width
    const centerX: number = width / 2
    const { top, bottom } = this.#drawHomeBackground(context)
    const headlineScale: number = fittedScale(settings.arcade.headline, 3, width - 8)
    const headlineHeight: number = GLYPH_HEIGHT * headlineScale + HEADLINE_DEPTH
    // The arcade button takes whatever room the text leaves, so it's as big as the screen allows
    // and shrinks when the corner logo takes up space.
    const textHeight: number = headlineHeight + GLYPH_HEIGHT * 2
    const room: number = (bottom - top - textHeight - 3 * 9) / 50
    const size: number = Math.max(0.6, Math.min(1.6, room))
    const buttonHeight: number = Math.round(50 * size)
    const [headlineY = 0, subheadY = 0, buttonTop = 0, pressY = 0] = column(
      [headlineHeight, GLYPH_HEIGHT, buttonHeight, GLYPH_HEIGHT],
      top,
      bottom,
      14,
    )
    this.#drawHeadline(context, settings.arcade.headline, headlineY, headlineScale)
    text(context, settings.arcade.subhead, centerX, subheadY, GOLD, {
      align: 'center',
    })

    // A big arcade button that presses itself every so often.
    const buttonY: number = buttonTop + Math.round(18 * size)
    const pressed: boolean = this.#frame % 100 > 88
    const press: number = pressed ? 2 : 0
    ellipse(context, centerX, buttonY + 7 * size, 46 * size, 25 * size, '#000000')
    ellipse(context, centerX, buttonY + 6 * size, 44 * size, 23 * size, '#1b1e2b')
    ellipse(context, centerX, buttonY + 5 * size, 40 * size, 20 * size, EDGE)
    const depth: number = pressed ? 2 : 6
    for (let layer: number = depth; layer > 0; layer -= 1) {
      ellipse(context, centerX, buttonY + layer - 2, 34 * size, 16 * size, BRAND_DEEP)
    }
    ellipse(context, centerX, buttonY - 2 + press, 34 * size, 16 * size, BRAND)
    ellipse(context, centerX - 10 * size, buttonY - 9 * size + press, 10 * size, 3, '#a9b7ff')
    const labelScale: number = size >= 1.3 ? 3 : size >= 0.85 ? 2 : 1
    text(context, 'PLAY', centerX, buttonY - 2 - (7 * labelScale) / 2 + press, INK, {
      scale: labelScale,
      align: 'center',
      shadow: BRAND_DEEP,
    })

    if (blink(this.#frame, 60)) {
      text(context, 'PRESS ENTER', centerX, pressY, INK, { align: 'center' })
    }

    // Tapes: the event along the top, today's top scorers along the bottom.
    drawTape(context, this.#frame, 0, settings.arcade.eventName, GOLD, NIGHT, 1)
    const leaders: string[] = GAMES.flatMap((definition: GameDefinition): string[] => {
      const best: ScoreEntry | undefined = topScores(definition.id, 1)[0]
      return best ? [`${gameTitle(definition, settings)}: ${best.initials} ${best.score}`] : []
    })
    const scorers: string =
      leaders.length > 0 ? `TOP SCORER  ${leaders.join('   ·   ')}` : "BE TODAY'S FIRST HIGH SCORE!"
    // The bottom tape also tells players how to see the full board.
    const bottomTape: string = `${scorers}   ■   ${actionKey('leaderboard')}: TOP 10`
    drawTape(context, this.#frame, stage.height - TAPE_HEIGHT, bottomTape, BRAND_DEEP, INK, -1)
  }

  #drawLeaderboard(context: CanvasRenderingContext2D): void {
    const settings: BoothSettings = getSettings()
    const width: number = stage.width
    const centerX: number = width / 2
    if (settings.display.mode === 'corner') {
      drawNeonScene(context, this.#frame)
      this.#dim(context, 0.6)
    } else {
      this.#dim(context, 0.9)
    }
    const titleColor: string =
      BOUNCE_COLORS[Math.floor(this.#frame / 30) % BOUNCE_COLORS.length] ?? GOLD
    this.#title(context, "TODAY'S TOP 10", 8, titleColor, 2)

    const footerY: number = stage.height - 14
    const listTop: number = 44
    // Show all ten when they fit, otherwise as many as fit.
    const rowHeight: number = Math.max(8, Math.min(11, Math.floor((footerY - 4 - listTop) / 10)))
    const rows: number = Math.min(BOARD_SIZE, Math.floor((footerY - 4 - listTop) / rowHeight))
    // One column per game. Rows drop the rank, then the padding, when the columns don't fit.
    const columns: number = GAMES.length
    const formats: readonly ((rank: number, entry: ScoreEntry | undefined) => string)[] = [
      (rank, entry) =>
        `${String(rank + 1).padStart(2, ' ')}. ${entry ? `${entry.initials} ${pad(entry.score)}` : '--- -----'}`,
      (rank, entry) =>
        `${String(rank + 1).padStart(2, ' ')} ${entry ? `${entry.initials} ${pad(entry.score, 4)}` : '--- ----'}`,
      (_rank, entry) => (entry ? `${entry.initials} ${pad(entry.score, 4)}` : '--- ----'),
    ]
    const sample = (format: (typeof formats)[number]): number =>
      // Scores are four digits in practice; a rare fifth digit just runs into the gutter.
      textWidth(format(9, { initials: 'AAA', score: 9999 } as ScoreEntry))
    const format: (typeof formats)[number] =
      formats.find(
        (candidate): boolean => sample(candidate) * columns + 8 * (columns - 1) <= width - 8,
      ) ?? formats[formats.length - 1]!
    const rowWidth: number = sample(format)
    const gutter: number = Math.min(
      40,
      Math.max(8, Math.floor((width - 8 - rowWidth * columns) / Math.max(1, columns - 1))),
    )
    const left: number = Math.round(centerX - (rowWidth * columns + gutter * (columns - 1)) / 2)
    const staggered: boolean = GAMES.some(
      (definition: GameDefinition): boolean =>
        textWidth(gameTitle(definition, settings)) > rowWidth + gutter - 4,
    )
    GAMES.forEach((definition: GameDefinition, index: number): void => {
      const x: number = left + index * (rowWidth + gutter)
      const columnCenter: number = x + rowWidth / 2
      // When titles are wider than their columns, alternate them between two lines so
      // neighbors never overlap.
      const titleY: number = staggered ? (index % 2 === 0 ? 25 : 34) : 30
      // Titles near the edges shift inward so they stay on screen.
      const half: number = textWidth(gameTitle(definition, settings)) / 2
      const titleX: number = Math.max(half + 2, Math.min(width - half - 2, columnCenter))
      text(context, gameTitle(definition, settings), titleX, titleY, GOLD, {
        align: 'center',
      })
      const board: ScoreEntry[] = topScores(definition.id, BOARD_SIZE)
      for (let rank: number = 0; rank < rows; rank += 1) {
        const entry: ScoreEntry | undefined = board[rank]
        const label: string = format(rank, entry)
        const color: string = !entry ? DIM : rank === 0 ? INK : rank < 3 ? '#c9cede' : MUTED
        text(context, label, x, listTop + rank * rowHeight, color)
      }
    })

    if (this.#autoBoard) {
      this.#keyHints(context, footerY, [{ keys: ['confirm'], label: 'HOME' }])
    } else if (!this.#drawTimeout(context, LEADERBOARD_TIMEOUT, footerY)) {
      this.#keyHints(
        context,
        footerY,
        [{ keys: ['leaderboard', 'back'], label: 'RETURN' }],
        [{ keys: ['back'], label: 'RETURN' }],
      )
    }
  }

  #drawSelect(context: CanvasRenderingContext2D): void {
    const settings: BoothSettings = getSettings()
    this.#dim(context, 0.9)
    const width: number = stage.width
    const centerX: number = width / 2
    this.#title(context, 'CHOOSE YOUR GAME', 8, INK, 2)

    const footerY: number = stage.height - 14
    const top: number = 28
    const cardHeight: number = footerY - 6 - top
    const previewHeight: number = Math.max(0, cardHeight - 62)
    const gutter: number = 10
    const count: number = GAMES.length
    // Side by side when every card fits; otherwise a carousel, with the selected card in the
    // middle and its neighbors peeking in from the sides.
    const sideBySide: boolean = (width - 26 - gutter * (count - 1)) / count >= 134
    const cardWidth: number = sideBySide
      ? Math.min(170, Math.floor((width - 26 - gutter * (count - 1)) / count))
      : // Wide enough for a 14-letter title at full size.
        Math.min(180, width - 64)
    const accent: string =
      BOUNCE_COLORS[Math.floor(this.#frame / 30) % BOUNCE_COLORS.length] ?? BRAND

    // Both titles share one size, the largest that fits every card.
    const titleScale: number = Math.min(
      ...GAMES.map((definition: GameDefinition): number =>
        fittedScale(gameTitle(definition, settings), 2, cardWidth - 8),
      ),
    )
    GAMES.forEach((definition: GameDefinition, index: number): void => {
      const selected: boolean = index === this.#selected
      // Places from the selected card, wrapping around so there is a neighbor on each side.
      let offset: number = (index - this.#selected + count) % count
      if (offset > count / 2) offset -= count
      const x: number = sideBySide
        ? centerX - (cardWidth * count + gutter * (count - 1)) / 2 + index * (cardWidth + gutter)
        : centerX - cardWidth / 2 + offset * (cardWidth + gutter)
      if (x + cardWidth < 0 || x > width) return
      const y: number = top - (selected ? 2 : 0)
      rect(context, x, y, cardWidth, cardHeight, PANEL)
      outline(context, x, y, cardWidth, cardHeight, selected ? accent : EDGE, selected ? 2 : 1)
      if (previewHeight >= 16) {
        context.save()
        context.beginPath()
        context.rect(x + 6, y + 6, cardWidth - 12, previewHeight)
        context.clip()
        definition.drawPreview(
          context,
          x + 6,
          y + 6,
          cardWidth - 12,
          previewHeight,
          selected ? this.#frame : 0,
        )
        context.restore()
        outline(context, x + 6, y + 6, cardWidth - 12, previewHeight, '#1d2133')
      }
      const below: number = y + 6 + (previewHeight >= 16 ? previewHeight : 0)
      const title: string = gameTitle(definition, settings)
      text(
        context,
        title,
        x + cardWidth / 2,
        below + 7 + (2 - titleScale) * 3,
        selected ? INK : MUTED,
        {
          scale: titleScale,
          align: 'center',
        },
      )
      text(
        context,
        settings[definition.id].tagline,
        x + cardWidth / 2,
        below + 26,
        selected ? GOLD : DIM,
        { align: 'center' },
      )
      const best: ScoreEntry | undefined = topScores(definition.id, 1)[0]
      text(
        context,
        best ? `BEST ${best.initials} ${pad(best.score, 4)}` : 'NO SCORES YET',
        x + cardWidth / 2,
        below + 41,
        selected ? MUTED : DIM,
        { align: 'center' },
      )
      if (selected && (blink(this.#frame, 30) || !sideBySide)) {
        text(context, '▶', x - 8, y + cardHeight / 2 - 3, accent, { shadow: false })
        text(context, '◀', x + cardWidth + 3, y + cardHeight / 2 - 3, accent, { shadow: false })
      }
    })
    if (!sideBySide) {
      // Page dots show there is more than one game.
      GAMES.forEach((_definition: GameDefinition, index: number): void => {
        const dotX: number = centerX - GAMES.length * 4 + index * 8 + 2
        rect(context, dotX, top + cardHeight + 1, 4, 2, index === this.#selected ? accent : DIM)
      })
    }

    if (!this.#drawTimeout(context, SELECT_TIMEOUT, footerY)) {
      this.#keyHints(
        context,
        footerY,
        [
          { keys: ['left', 'right'], label: 'CHOOSE' },
          { keys: ['confirm'], label: 'PLAY' },
          { keys: ['back'], label: 'EXIT' },
        ],
        [
          { keys: ['left', 'right'], label: 'CHOOSE' },
          { keys: ['confirm'], label: 'PLAY' },
        ],
      )
    }
  }

  #drawKeypad(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    keys: readonly KeyHint[],
  ): void {
    const size: number = 13
    const gap: number = 2
    const layout: readonly (readonly string[])[] = [
      ['7', '8', '9'],
      ['4', '5', '6'],
      ['1', '2', '3'],
      ['0', '.'],
    ]
    // Light every keypad key bound to one of the game's actions.
    const highlighted: Set<string> = new Set(
      keys.flatMap((hint: KeyHint): string[] => keypadLabels(hint.action)),
    )
    layout.forEach((row: readonly string[], rowIndex: number): void => {
      let keyColumn: number = 0
      for (const key of row) {
        const wide: boolean = key === '0'
        const width: number = wide ? size * 2 + gap : size
        const keyX: number = x + keyColumn * (size + gap)
        const keyY: number = y + rowIndex * (size + gap)
        const lit: boolean = highlighted.has(key)
        const pulse: boolean = lit && blink(this.#frame + rowIndex * 7, 50)
        rect(context, keyX, keyY + 1, width, size, '#000000')
        rect(context, keyX, keyY, width, size, lit ? (pulse ? BRAND : BRAND_DEEP) : '#1b1e2b')
        outline(context, keyX, keyY, width, size, lit ? '#a9b7ff' : EDGE)
        text(context, key, keyX + width / 2, keyY + 3, lit ? INK : DIM, {
          align: 'center',
          shadow: false,
        })
        keyColumn += wide ? 2 : 1
      }
    })
  }

  #drawReady(context: CanvasRenderingContext2D): void {
    this.#dim(context, 0.86)
    const definition: GameDefinition = this.#definition
    const width: number = stage.width
    const centerX: number = width / 2
    this.#title(context, gameTitle(definition), 8, INK, 2)
    const limit: number = getSettings().arcade.timeLimit
    hint(
      context,
      limit > 0 ? `HOW TO PLAY  ·  ${limit} SECONDS` : 'HOW TO PLAY',
      'HOW TO PLAY',
      28,
      GOLD,
    )

    // Keypad, key list, and countdown side by side.
    const footerY: number = stage.height - 14
    const keypadWidth: number = 43
    const keypadHeight: number = 58
    const rows: readonly KeyHint[] = [...definition.keys, definition.pauseKey]
    // Keys like BACK are wider than a digit, so the label column starts after the widest key.
    const keyWidth: number =
      Math.max(
        ...rows.map((row: KeyHint): number =>
          Math.max(KEYCAP, textWidth(actionKey(row.action)) + 6),
        ),
      ) + 5
    const labelWidth: number =
      keyWidth + Math.max(...rows.map((row: KeyHint): number => textWidth(row.label)))
    const countdownWidth: number = 54
    const total: number = keypadWidth + 14 + labelWidth + 16 + countdownWidth
    const left: number = Math.round(centerX - total / 2)
    const blockTop: number = Math.round(40 + Math.max(0, (footerY - 8 - 40 - keypadHeight) / 2))

    this.#drawKeypad(context, left, blockTop, definition.keys)
    const labelsX: number = left + keypadWidth + 14
    const labelsTop: number = blockTop + Math.round((keypadHeight - rows.length * 13 + 6) / 2)
    rows.forEach((row: KeyHint, index: number): void => {
      const rowY: number = labelsTop + index * 13
      const pause: boolean = index === rows.length - 1
      const key: string = actionKey(row.action)
      const capWidth: number = Math.max(KEYCAP, textWidth(key) + 6)
      this.#keycap(context, key, '', labelsX + capWidth / 2, rowY - 2, this.#flashing(row.action))
      text(context, row.label, labelsX + keyWidth, rowY, pause ? MUTED : INK)
    })

    const countdownX: number = labelsX + labelWidth + 16 + countdownWidth / 2
    const middle: number = blockTop + keypadHeight / 2
    const remaining: number = Math.max(1, Math.ceil((COUNTDOWN - this.#age) / TICKS_PER_SECOND))
    // The full countdown shows, so players know how long they have to read the keys.
    text(context, 'GET READY', countdownX, middle - 18, remaining <= 3 ? INK : MUTED, {
      align: 'center',
    })
    text(context, String(remaining), countdownX, middle - 6, remaining <= 3 ? INK : MUTED, {
      scale: 3,
      align: 'center',
    })
    this.#keyHints(
      context,
      footerY,
      [
        { keys: ['confirm'], label: 'START NOW' },
        { keys: ['back'], label: 'CHANGE GAME' },
      ],
      [
        { keys: ['confirm'], label: 'GO' },
        { keys: ['back'], label: 'CHANGE' },
      ],
    )
  }

  #drawPaused(context: CanvasRenderingContext2D): void {
    this.#dim(context, 0.75)
    const centerX: number = stage.width / 2
    const [titleY = 0, resumeY = 0, endY = 0, timeoutY = 0] = column(
      [21, KEYCAP, KEYCAP, GLYPH_HEIGHT],
      8,
      stage.height - 8,
      18,
    )
    text(context, 'PAUSED', centerX, titleY, INK, { scale: 3, align: 'center' })
    this.#keyHints(context, resumeY + 2, [{ keys: ['confirm'], label: 'RESUME' }])
    this.#keyHints(context, endY + 2, [{ keys: ['back'], label: 'END GAME' }])
    this.#drawTimeout(context, PAUSE_TIMEOUT, timeoutY)
  }

  #drawGameOver(context: CanvasRenderingContext2D): void {
    const finish: Finish | null = this.#finish
    if (!finish) return
    this.#dim(context, Math.min(0.82, this.#age / 30))
    const centerX: number = stage.width / 2
    const [titleY = 0, scoreY = 0, summaryY = 0, rankY = 0, pressY = 0] = column(
      [21, 14, finish.summary ? GLYPH_HEIGHT : 0, GLYPH_HEIGHT, KEYCAP],
      8,
      stage.height - 8,
      16,
    )
    const title: string = finish.headline
      ? finish.headline
      : finish.endedBy === 'quit'
        ? 'GAME ENDED'
        : finish.endedBy === 'time'
          ? "TIME'S UP!"
          : 'GAME OVER'
    this.#title(context, title, titleY, finish.endedBy === 'time' ? GOLD : INK, 3)
    text(context, `SCORE ${pad(finish.score, 4)}`, centerX, scoreY, GOLD, {
      scale: 2,
      align: 'center',
    })
    if (finish.summary) {
      text(context, finish.summary, centerX, summaryY, MUTED, {
        align: 'center',
        maxWidth: stage.width - 8,
      })
    }
    if (finish.rank === 1 && blink(this.#frame, 30)) {
      text(context, 'NEW BEST TODAY!', centerX, rankY, INK, { align: 'center' })
    } else if (finish.rank !== null) {
      text(context, `#${finish.rank} TODAY`, centerX, rankY, MUTED, { align: 'center' })
    }
    if (this.#age > GAME_OVER_LOCK) {
      this.#keyHints(context, pressY + 2, [{ keys: ['confirm'], label: 'CONTINUE' }])
    }
  }

  /** Draws keycap prompts like [4][6] CHOOSE  [ENTER] PLAY, centered on the screen. */
  #keyHints(
    context: CanvasRenderingContext2D,
    y: number,
    items: readonly KeyPrompt[],
    compact: readonly KeyPrompt[] = items,
  ): void {
    const capWidth = (action: Action): number => Math.max(KEYCAP, textWidth(actionKey(action)) + 6)
    const measure = (prompts: readonly KeyPrompt[]): number =>
      prompts.reduce(
        (sum: number, prompt: KeyPrompt, index: number): number =>
          sum +
          (index > 0 ? 12 : 0) +
          prompt.keys.reduce(
            (keys: number, action: Action): number => keys + capWidth(action) + 2,
            0,
          ) +
          3 +
          textWidth(prompt.label),
        0,
      )
    const prompts: readonly KeyPrompt[] = measure(items) <= stage.width - 8 ? items : compact
    let x: number = Math.round(stage.width / 2 - measure(prompts) / 2)
    prompts.forEach((prompt: KeyPrompt, index: number): void => {
      if (index > 0) x += 12
      for (const action of prompt.keys) {
        const width: number = capWidth(action)
        this.#keycap(context, actionKey(action), '', x + width / 2, y - 2, this.#flashing(action))
        x += width + 2
      }
      x += 3
      text(context, prompt.label, x, y, INK)
      x += textWidth(prompt.label)
    })
  }

  #flashing(action: Action): boolean {
    const at: number | undefined = this.#keyPressedAt.get(action)
    return at !== undefined && this.#frame - at < 8
  }

  /**
   * A keypad keycap centered at x with its top at y, with an optional arrow beside it showing
   * what it does. Lit keycaps flash when pressed; disabled ones are dimmed.
   */
  #keycap(
    context: CanvasRenderingContext2D,
    label: string,
    arrow: string,
    x: number,
    y: number,
    pressed: boolean,
    enabled: boolean = true,
    arrowSide: 'left' | 'right' = 'right',
  ): void {
    const width: number = Math.max(KEYCAP, textWidth(label) + 6)
    const left: number = Math.round(x - width / 2)
    const sink: number = pressed ? 1 : 0
    rect(context, left, y + 1, width, KEYCAP, '#000000')
    rect(
      context,
      left,
      y + sink,
      width,
      KEYCAP,
      !enabled ? '#1b1e2b' : pressed ? BRAND : BRAND_DEEP,
    )
    outline(context, left, y + sink, width, KEYCAP, enabled ? '#a9b7ff' : EDGE)
    text(context, label, left + width / 2, y + 2 + sink, enabled ? INK : DIM, {
      align: 'center',
      shadow: false,
    })
    if (arrow) {
      const arrowX: number = arrowSide === 'right' ? left + width + 2 : left - 7
      text(context, arrow, arrowX, y + 2, enabled ? GOLD : DIM, { shadow: false })
    }
  }

  #drawInitials(context: CanvasRenderingContext2D): void {
    const finish: Finish | null = this.#finish
    if (!finish) return
    rect(context, 0, 0, stage.width, stage.height, NIGHT)
    const centerX: number = stage.width / 2
    const color: string = BOUNCE_COLORS[Math.floor(this.#frame / 12) % BOUNCE_COLORS.length] ?? GOLD
    const board: ScoreEntry[] = topScores(finish.definition.id, 3)
    // Show as much of today's board as fits below the letters.
    let boardRows: number = board.length
    const heights = (rows: number): number[] => [
      14,
      GLYPH_HEIGHT,
      GLYPH_HEIGHT,
      LETTERS_BLOCK,
      KEYCAP,
      ...(rows > 0 ? [rows * 10 - 3] : []),
    ]
    const fits = (rows: number): boolean =>
      heights(rows).reduce((sum: number, height: number): number => sum + height, 0) +
        (heights(rows).length - 1) * 4 <=
      stage.height - 8
    while (boardRows > 0 && !fits(boardRows)) boardRows -= 1
    const [headerY = 0, infoY = 0, promptY = 0, lettersTop = 0, hintY = 0, boardY = 0] = column(
      heights(boardRows),
      4,
      stage.height - 4,
      10,
    )

    this.#title(context, 'HIGH SCORE!', headerY, color, 2)
    hint(
      context,
      `${finish.title}  ${pad(finish.score, 4)}  #${finish.rank ?? '-'} TODAY`,
      `${pad(finish.score, 4)}  #${finish.rank ?? '-'} TODAY`,
      infoY,
    )
    text(context, 'ENTER YOUR INITIALS', centerX, promptY, INK, { align: 'center' })

    // The letters sit between keycaps for the keypad keys that drive them, so players see the
    // number to press rather than an abstract arrow.
    const slotWidth: number = 26
    const firstX: number = centerX - slotWidth * 1.5
    const lettersY: number = lettersTop + KEYCAP + 3
    this.#letters.forEach((letterIndex: number, slot: number): void => {
      const x: number = firstX + slot * slotWidth
      const active: boolean = slot === this.#slot
      text(
        context,
        LETTERS[letterIndex] ?? 'A',
        x + slotWidth / 2,
        lettersY,
        active ? INK : MUTED,
        {
          scale: 3,
          align: 'center',
        },
      )
      rect(
        context,
        x + 4,
        lettersY + 23,
        slotWidth - 8,
        2,
        active && blink(this.#frame, 30) ? GOLD : DIM,
      )
      if (active) {
        this.#keycap(
          context,
          actionKey('up'),
          '▲',
          x + slotWidth / 2,
          lettersTop,
          this.#flashing('up'),
        )
        this.#keycap(
          context,
          actionKey('down'),
          '▼',
          x + slotWidth / 2,
          lettersY + 27,
          this.#flashing('down'),
        )
      }
    })
    const middleY: number = lettersY + 5
    // Side keycaps grow outward when a wider key (like an arrow key's name) is bound.
    const sideWidth = (key: string): number => Math.max(KEYCAP, textWidth(key) + 6)
    const leftKey: string = actionKey('left')
    const rightKey: string = actionKey('right')
    this.#keycap(
      context,
      leftKey,
      '◀',
      firstX - 4.5 - sideWidth(leftKey) / 2,
      middleY,
      this.#flashing('left'),
      this.#slot > 0,
      'left',
    )
    this.#keycap(
      context,
      rightKey,
      '▶',
      firstX + slotWidth * 3 + 0.5 + sideWidth(rightKey) / 2,
      middleY,
      this.#flashing('right'),
      this.#slot < 2,
    )

    if (!this.#drawTimeout(context, INITIALS_TIMEOUT, hintY + 2)) {
      this.#keyHints(context, hintY + 2, [
        { keys: ['confirm'], label: this.#slot < 2 ? 'NEXT' : 'SAVE' },
      ])
    }
    board.slice(0, boardRows).forEach((entry: ScoreEntry, index: number): void => {
      text(
        context,
        `${index + 1}. ${entry.initials} ${pad(entry.score, 4)}`,
        centerX,
        boardY + index * 10,
        DIM,
        { align: 'center' },
      )
    })
  }

  #drawReward(context: CanvasRenderingContext2D): void {
    const finish: Finish | null = this.#finish
    if (!finish) return
    const arcade: ArcadeSection = getSettings().arcade
    const width: number = stage.width
    rect(context, 0, 0, width, stage.height, NIGHT)
    for (const piece of this.#confetti) {
      rect(context, piece.x * width + Math.sin(piece.drift) * 3, piece.y, 2, 2, piece.color)
    }
    const centerX: number = width / 2
    const { tier, next } = finish.reward
    const label: string = `${tier.name} TIER`
    const badgeScale: number = fittedScale(label, 3, width - 32)
    const badgeHeight: number = GLYPH_HEIGHT * badgeScale + 13
    const handoffWidth: number = Math.max(
      textWidth(arcade.handoffLine1),
      textWidth(arcade.handoffLine2),
    )
    const panelWidth: number = Math.min(width - 4, Math.max(200, handoffWidth + 16))
    const panelHeight: number = 44
    const [reachedY = 0, badgeY = 0, pipsY = 0, scoreY = 0, nextY = 0, panelY = 0, footerY = 0] =
      column(
        [GLYPH_HEIGHT, badgeHeight, 3, GLYPH_HEIGHT, GLYPH_HEIGHT, panelHeight, GLYPH_HEIGHT],
        6,
        stage.height - 6,
        12,
      )

    text(context, 'YOU REACHED', centerX, reachedY, MUTED, { align: 'center' })
    const badgeWidth: number = textWidth(label, badgeScale) + 24
    rect(context, centerX - badgeWidth / 2, badgeY + 2, badgeWidth, badgeHeight, '#000000')
    rect(context, centerX - badgeWidth / 2, badgeY, badgeWidth, badgeHeight, tier.color)
    rect(context, centerX - badgeWidth / 2 + 2, badgeY + 2, badgeWidth - 4, badgeHeight - 4, NIGHT)
    text(context, label, centerX, badgeY + 7, tier.color, { scale: badgeScale, align: 'center' })
    // Tier pips show how far up the ladder this run reached.
    REWARD_TIERS.forEach((_tier: unknown, index: number): void => {
      rect(
        context,
        centerX - REWARD_TIERS.length * 5 + index * 10 + 2,
        pipsY,
        6,
        3,
        index <= finish.reward.level ? tier.color : DIM,
      )
    })

    hint(
      context,
      `${finish.title}  ·  SCORE ${pad(finish.score, 4)}`,
      `SCORE ${pad(finish.score, 4)}`,
      scoreY,
      INK,
    )
    if (SHOW_CREDITS && tier.credits > 0) {
      text(context, `${tier.credits} GENAI CREDITS`, centerX, nextY, GOLD, { align: 'center' })
    } else if (next) {
      text(context, `${next.pointsNeeded} MORE FOR ${next.tier.name}`, centerX, nextY, MUTED, {
        align: 'center',
      })
    } else {
      text(context, 'TOP TIER!', centerX, nextY, GOLD, { align: 'center' })
    }

    const panelX: number = centerX - panelWidth / 2
    rect(context, panelX, panelY, panelWidth, panelHeight, PANEL)
    outline(context, panelX, panelY, panelWidth, panelHeight, EDGE)
    text(context, arcade.handoffLine1, centerX, panelY + 5, INK, { align: 'center' })
    text(context, arcade.handoffLine2, centerX, panelY + 15, INK, { align: 'center' })
    // The claim code staff look up in the admin window.
    const code: string = finish.code ?? '····'
    const codeWidth: number = textWidth('CODE ') + textWidth(code, 2)
    const codeX: number = centerX - codeWidth / 2
    text(context, 'CODE', codeX, panelY + 30, MUTED)
    text(context, code, codeX + textWidth('CODE '), panelY + 26, GOLD, { scale: 2 })

    const rewardTimeout: number = seconds(arcade.rewardSeconds)
    if (!this.#drawTimeout(context, rewardTimeout, footerY) && this.#age > REWARD_LOCK) {
      this.#keyHints(context, footerY, [{ keys: ['confirm'], label: 'FINISH' }])
    }
  }

  #drawVolume(context: CanvasRenderingContext2D): void {
    const volume: number = getSettings().arcade.volume
    const label: string = volume === 0 ? 'MUTE' : 'VOL'
    const width: number = 30 + MAX_VOLUME * 5
    const x: number = stage.width - width - 10
    const y: number = 18
    rect(context, x, y, width, 15, PANEL)
    outline(context, x, y, width, 15, EDGE)
    text(context, label, x + 4, y + 4, INK, { shadow: false })
    for (let level: number = 0; level < MAX_VOLUME; level += 1) {
      rect(context, x + 28 + level * 5, y + 4, 4, 7, level < volume ? BRAND : DIM)
    }
  }

  /** A calibration pattern for lining up the picture on the TV. */
  #drawTestPattern(context: CanvasRenderingContext2D): void {
    const width: number = stage.width
    const height: number = stage.height
    const centerX: number = Math.floor(width / 2)
    const centerY: number = Math.floor(height / 2)
    outline(context, 0, 0, width, height, DANGER)
    outline(context, 2, 2, width - 4, height - 4, GOLD)
    // Corner marks: all four should be fully visible on the TV.
    for (const [x, y] of [
      [0, 0],
      [width - 12, 0],
      [0, height - 12],
      [width - 12, height - 12],
    ] as const) {
      rect(context, x, y, 12, 12, DANGER)
    }
    rect(context, centerX - 10, centerY, 21, 1, INK)
    rect(context, centerX, centerY - 10, 1, 21, INK)
    // A circle and a square: both look round and square on the TV when the stretch is right.
    const radius: number = Math.floor(height * 0.32)
    context.fillStyle = BRAND
    for (let step: number = 0; step < 360; step += 1) {
      const angle: number = (step / 360) * Math.PI * 2
      context.fillRect(
        Math.round(centerX + Math.cos(angle) * radius),
        Math.round(centerY + Math.sin(angle) * radius),
        1,
        1,
      )
    }
    const side: number = Math.floor(radius * 0.9)
    outline(context, centerX - side / 2, centerY - side / 2, side, side, '#22c55e')
    hint(
      context,
      'CIRCLE ROUND? SQUARE SQUARE? ALL 4 CORNERS SHOWING?',
      'CIRCLE ROUND? CORNERS SHOWING?',
      16,
      INK,
    )
    text(context, `${width}X${height} ARCADE PIXELS`, centerX, height - 22, MUTED, {
      align: 'center',
    })
  }
}
