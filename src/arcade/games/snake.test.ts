// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../../lib/booth'
import { updateSettings } from '../../lib/boothStore'
import { BASE_HEIGHT, BASE_WIDTH, stage } from '../pixel'
import { run, silentSound } from '../testing'
import { SNAKE } from './snake'

// Six moves a second is one move every 10 ticks.
const STEP_TICKS: number = 10

describe('File Snake', (): void => {
  beforeEach((): void => {
    stage.width = BASE_WIDTH
    stage.height = BASE_HEIGHT
    updateSettings(defaultSettings())
    updateSettings({ snake: { startSpeed: 6, speedupBy: 0 } })
  })
  afterEach((): void => {
    vi.restoreAllMocks()
  })

  it('eats a file, scores, and keeps going', (): void => {
    // With a zero roll, the first file lands in the top-left cell.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const game = SNAKE.create(silentSound, 0)
    // The head starts at (15, 10) heading right: go up 10 rows, then left 15 columns.
    run(game, STEP_TICKS * 10, ['up'])
    run(game, STEP_TICKS * 15, ['left'])
    expect(game.score).toBe(10)
    expect(game.over).toBe(false)
  })

  it('ignores a turn straight back into its own body', (): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const game = SNAKE.create(silentSound, 0)
    run(game, STEP_TICKS * 3, ['left'])
    expect(game.over).toBe(false)
  })

  it('ends after hitting a wall and playing the crash', (): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const game = SNAKE.create(silentSound, 0)
    // 22 moves reach the right edge; the 23rd hits the wall.
    run(game, STEP_TICKS * 23)
    expect(game.over).toBe(false)
    run(game, 100)
    expect(game.over).toBe(true)
    expect(game.score).toBe(0)
  })

  it('grows by the configured amount per file', (): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    updateSettings({ snake: { growth: 3 } })
    const game = SNAKE.create(silentSound, 0)
    run(game, STEP_TICKS * 10, ['up'])
    run(game, STEP_TICKS * 15, ['left'])
    expect(game.score).toBe(10)
    // Length 4 plus 3 segments: turning down and right into the tail's old cells is safe only
    // once the tail has moved on, so a short body survives the loop and a long one doesn't.
    run(game, STEP_TICKS, ['down'])
    run(game, STEP_TICKS, ['right'])
    run(game, STEP_TICKS, ['up'])
    run(game, 100)
    expect(game.over).toBe(true)
  })

  it('speeds up live when staff change the speed', (): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const game = SNAKE.create(silentSound, 0)
    // At 6 moves a second, 22 moves take 220 ticks; at 12 they take 110.
    updateSettings({ snake: { startSpeed: 12, topSpeed: 12 } })
    run(game, STEP_TICKS * 12)
    expect(game.over).toBe(false)
    run(game, 100)
    expect(game.over).toBe(true)
  })

  it('sizes the board to the screen and the square size', (): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    // A bigger square means fewer columns: 16-pixel squares give 19 columns, so the head
    // starts at column 5 and has 13 moves before the wall.
    updateSettings({ snake: { cellSize: 16 } })
    const game = SNAKE.create(silentSound, 0)
    run(game, STEP_TICKS * 13)
    expect(game.over).toBe(false)
    run(game, STEP_TICKS + 100)
    expect(game.over).toBe(true)
  })

  it('sums up the library of files it ate, cut to fit the screen', (): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const game = SNAKE.create(silentSound, 0)
    expect(game.summary).toBe('LIBRARY: EMPTY')
    run(game, STEP_TICKS * 10, ['up'])
    run(game, STEP_TICKS * 15, ['left'])
    expect(game.summary).toBe('LIBRARY: 1 PNG')
  })
})
