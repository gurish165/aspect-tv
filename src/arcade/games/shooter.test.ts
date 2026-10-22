// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SHOOTER_PRESETS, defaultSettings } from '../../lib/booth'
import { updateSettings } from '../../lib/boothStore'
import type { Action } from '../input'
import { seeded, stage } from '../pixel'
import { inputFrame, silentSound } from '../testing'
import type { Game } from './types'
import { SHOOTER } from './shooter'

/** Steps a game with the same keys held (and pressed on the first tick) for a number of ticks. */
function hold(game: Game, ticks: number, actions: readonly Action[] = []): void {
  for (let tick: number = 0; tick < ticks && !game.over; tick += 1) {
    game.update(inputFrame(tick === 0 ? actions : [], actions))
  }
}

function ticksUntilOver(
  game: Game,
  actions: readonly Action[] = [],
  limit: number = 60 * 600,
): number {
  let ticks: number = 0
  while (!game.over && ticks < limit) {
    game.update(inputFrame([], actions))
    ticks += 1
  }
  return ticks
}

describe('Bodega Blaster', (): void => {
  beforeEach((): void => {
    updateSettings(defaultSettings())
    stage.width = 312
    stage.height = 178
  })
  afterEach((): void => {
    vi.restoreAllMocks()
  })

  it('shoots pests in the formation for points', (): void => {
    // No dives and no enemy fire, so the cab can't be hit while it shoots.
    updateSettings({ shooter: { diveEvery: 6, enemyFire: 0 } })
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const game = SHOOTER.create(silentSound, 0)
    // Wait for the wave to fly in, then line up under a column and keep firing.
    hold(game, 90)
    hold(game, 7, ['right'])
    hold(game, 120, ['fire'])
    expect(game.score).toBeGreaterThan(0)
    expect(game.summary).toMatch(/^WAVE 1 · \d+ PESTS/)
  })

  it('clears a wave and moves on to the next one', (): void => {
    // A calm formation and plenty of cabs; sweep the whole street with fire held down.
    vi.spyOn(Math, 'random').mockImplementation(seeded(7))
    updateSettings({ shooter: { lives: 5, diveEvery: 6, enemyFire: 0 } })
    const game = SHOOTER.create(silentSound, 0)
    for (let sweep: number = 0; sweep < 30 && !game.summary?.startsWith('WAVE 2'); sweep += 1) {
      // 190 ticks at the cab's speed crosses the full width, so every column gets swept.
      hold(game, 190, [sweep % 2 === 0 ? 'right' : 'left', 'fire'])
    }
    expect(game.summary).toMatch(/^WAVE 2/)
    // 34 pests at 10 to 80 points each, plus the wave bonus.
    expect(game.score).toBeGreaterThan(500)
  })

  it('ends after the last cab is hit when nobody steers', (): void => {
    updateSettings({ shooter: { lives: 1 } })
    const game = SHOOTER.create(silentSound, 0)
    const ticks: number = ticksUntilOver(game)
    expect(game.over).toBe(true)
    expect(ticks).toBeLessThan(60 * 600)
    expect(game.endTitle?.('game over')).toBe('OFF DUTY!')
    expect(game.endTitle?.('time')).toBe("I'M WALKIN' HERE!")
  })

  it('lasts longer with more lives', (): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3)
    updateSettings({ shooter: { lives: 1 } })
    const one: number = ticksUntilOver(SHOOTER.create(silentSound, 0))
    updateSettings({ shooter: { lives: 4 } })
    const four: number = ticksUntilOver(SHOOTER.create(silentSound, 0))
    expect(four).toBeGreaterThan(one)
  })

  it('gets tougher with each preset', (): void => {
    expect(SHOOTER_PRESETS.easy.diveEvery).toBeGreaterThan(SHOOTER_PRESETS.expert.diveEvery)
    expect(SHOOTER_PRESETS.easy.enemyFire).toBeLessThan(SHOOTER_PRESETS.expert.enemyFire)
    expect(SHOOTER_PRESETS.easy.lives).toBeGreaterThanOrEqual(SHOOTER_PRESETS.expert.lives)
  })
})
