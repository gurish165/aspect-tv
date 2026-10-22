// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RUNNER_PRESETS, defaultSettings } from '../../lib/booth'
import { updateSettings } from '../../lib/boothStore'
import { inputFrame, run, silentSound } from '../testing'
import { RUNNER } from './runner'

function ticksSurvived(holdJump: boolean): number {
  const game = RUNNER.create(silentSound, 0)
  let ticks: number = 0
  while (!game.over && ticks < 20000) {
    game.update(holdJump ? inputFrame(['jump'], ['jump']) : inputFrame())
    ticks += 1
  }
  return ticks
}

describe('On Set', (): void => {
  beforeEach((): void => {
    updateSettings(defaultSettings())
  })
  afterEach((): void => {
    vi.restoreAllMocks()
  })

  it('scores by distance and ends at the first bug when nobody jumps', (): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const game = RUNNER.create(silentSound, 0)
    run(game, 60)
    expect(game.score).toBeGreaterThan(10)
    run(game, 600)
    expect(game.over).toBe(true)
  })

  it('outlasts standing still by jumping', (): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const standing = RUNNER.create(silentSound, 0)
    let standingTicks: number = 0
    while (!standing.over && standingTicks < 5000) {
      standing.update(inputFrame())
      standingTicks += 1
    }

    // Hold jump the whole time: the runner bounces high and long, clearing ground obstacles.
    const jumping = RUNNER.create(silentSound, 0)
    let jumpingTicks: number = 0
    while (!jumping.over && jumpingTicks < 5000) {
      jumping.update(inputFrame(['jump'], ['jump']))
      jumpingTicks += 1
    }
    expect(jumpingTicks).toBeGreaterThan(standingTicks)
  })

  it('scores faster on a harder preset', (): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    updateSettings({ runner: RUNNER_PRESETS.easy })
    const easy = RUNNER.create(silentSound, 0)
    run(easy, 120)
    updateSettings({ runner: RUNNER_PRESETS.expert })
    const expert = RUNNER.create(silentSound, 0)
    run(expert, 120)
    expect(expert.score).toBeGreaterThan(easy.score)
  })

  it('always leaves room to land between obstacles', (): void => {
    // The tightest spacing and highest speed still let a held jump clear the course for a while.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    updateSettings({ runner: { startSpeed: 8, topSpeed: 8, spacing: 0.2 } })
    expect(ticksSurvived(true)).toBeGreaterThan(ticksSurvived(false))
  })

  it('ducks under pop-ups only while "." is held', (): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const game = RUNNER.create(silentSound, 0)
    // Holding "." keeps the runner low, so a jump press does nothing.
    run(game, 1)
    game.update(inputFrame(['jump'], ['jump', 'duck']))
    const before: number = game.score
    run(game, 30)
    expect(game.score).toBeGreaterThan(before)
    expect(game.over).toBe(false)
  })

  it("calls CUT! on a crash and THAT'S A WRAP! when time runs out", (): void => {
    const game = RUNNER.create(silentSound, 0)
    expect(game.endTitle?.('game over')).toBe('CUT!')
    expect(game.endTitle?.('time')).toBe("THAT'S A WRAP!")
  })
})
