import type { Sound } from '../audio'
import type { Action, InputFrame } from '../input'

export type GameId = 'snake' | 'runner'

export interface Game {
  readonly score: number
  /** True once the end-of-game animation has finished. */
  readonly over: boolean
  /** An optional line for the game-over screen, like what the player collected. */
  readonly summary?: string
  /** An optional game-over title in the game's own words, by how the game ended. */
  endTitle?(endedBy: 'game over' | 'time'): string
  update(input: InputFrame): void
  draw(context: CanvasRenderingContext2D, hud: Hud): void
}

export interface Hud {
  /** Whole seconds left on the clock, or null when there is no time limit. */
  secondsLeft: number | null
}

export interface KeyHint {
  /** The action whose first bound key is drawn on the keycap. */
  action: Action
  label: string
}

export interface GameDefinition {
  /** Titles, taglines, and difficulty live in the booth settings under this id. */
  id: GameId
  /** Keypad keys to highlight on the how-to-play screen. */
  keys: readonly KeyHint[]
  /** How to pause, shown under the keys. */
  pauseKey: KeyHint
  /** Actions that pause this game. */
  pauseActions: readonly Action[]
  create(sound: Sound, best: number): Game
  /** A tiny looping animation for the game picker. */
  drawPreview(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    frame: number,
  ): void
}
