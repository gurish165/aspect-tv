// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JETPACK_PRESETS, defaultSettings } from '../../lib/booth'
import { DEFAULT_FEEL } from '../../lib/flight'
import { updateSettings } from '../../lib/boothStore'
import { seeded, stage } from '../pixel'
import { inputFrame, silentSound } from '../testing'
import { JETPACK, type Flight, flightStep, rollSlot } from './jetpack'
import { SUIT_SIZES, type Suit } from './post'

const FLOOR: number = 160
const CEILING: number = 16

function flight(suit: Suit, onFloor: boolean = true): Flight {
  return {
    y: onFloor ? FLOOR - SUIT_SIZES[suit].height : 80,
    vy: 0,
    grounded: onFloor,
    gravity: 1,
    thrusting: false,
    holdTicks: 0,
    releaseTicks: 0,
  }
}

/** Steps a flight for a number of ticks with the button held or not. */
function fly(state: Flight, suit: Suit, ticks: number, held: boolean, marker: number = 60): void {
  for (let tick: number = 0; tick < ticks; tick += 1) {
    flightStep(state, suit, held, held && tick === 0, FLOOR, CEILING, marker)
  }
}

describe('Fix It In Post flight', (): void => {
  it('rises while the button is held and drifts down gently when let go', (): void => {
    const state: Flight = flight('jetpack')
    const start: number = state.y
    fly(state, 'jetpack', 40, true)
    expect(state.y).toBeLessThan(start - 30)
    expect(state.thrusting).toBe(true)
    const top: number = state.y
    fly(state, 'jetpack', 10, false)
    // Let go: it keeps drifting a little, then falls, but never faster than the top fall speed.
    for (let tick: number = 0; tick < 60; tick += 1) {
      const before: number = state.y
      flightStep(state, 'jetpack', false, false, FLOOR, CEILING, 60)
      expect(state.y - before).toBeLessThanOrEqual(DEFAULT_FEEL.maxFall + 1e-9)
    }
    expect(state.y).toBeGreaterThan(top)
  })

  it('stops at the ceiling and lands on the floor', (): void => {
    const state: Flight = flight('jetpack')
    fly(state, 'jetpack', 300, true)
    expect(state.y).toBe(CEILING)
    fly(state, 'jetpack', 300, false)
    expect(state.y).toBe(FLOOR - SUIT_SIZES.jetpack.height)
    expect(state.grounded).toBe(true)
  })

  it('flies the robo dragon upside down: let go to rise, hold to dive', (): void => {
    const state: Flight = flight('dragon', false)
    const start: number = state.y
    fly(state, 'dragon', 20, false)
    expect(state.y).toBeLessThan(start)
    const high: number = state.y
    fly(state, 'dragon', 30, true)
    expect(state.y).toBeGreaterThan(high)
  })

  it('jumps the rig from the floor and hovers it down while held', (): void => {
    const falling: Flight = flight('rig')
    const hovering: Flight = flight('rig')
    flightStep(falling, 'rig', true, true, FLOOR, CEILING, 60)
    flightStep(hovering, 'rig', true, true, FLOOR, CEILING, 60)
    expect(falling.vy).toBeLessThan(0)
    let fallingTicks: number = 0
    while (!falling.grounded && fallingTicks < 500) {
      flightStep(falling, 'rig', false, false, FLOOR, CEILING, 60)
      fallingTicks += 1
    }
    let hoverTicks: number = 0
    while (!hovering.grounded && hoverTicks < 500) {
      flightStep(hovering, 'rig', true, false, FLOOR, CEILING, 60)
      hoverTicks += 1
    }
    expect(hoverTicks).toBeGreaterThan(fallingTicks)
  })

  it('jumps the rig most of the way up the room, and the hog well over obstacles', (): void => {
    const peak = (suit: Suit, held: boolean): number => {
      const state: Flight = flight(suit)
      const start: number = state.y
      flightStep(state, suit, true, true, FLOOR, CEILING, 60)
      let highest: number = state.y
      for (let tick: number = 0; tick < 120; tick += 1) {
        flightStep(state, suit, held, false, FLOOR, CEILING, 60)
        highest = Math.min(highest, state.y)
      }
      return start - highest
    }
    expect(peak('rig', false)).toBeGreaterThan(80)
    expect(peak('hog', false)).toBeGreaterThan(25)
    expect(peak('hog', true)).toBeGreaterThan(65)
  })

  it('jumps higher on the road hog when the button is held', (): void => {
    const peak = (held: boolean): number => {
      const state: Flight = flight('hog')
      flightStep(state, 'hog', true, true, FLOOR, CEILING, 60)
      let highest: number = state.y
      for (let tick: number = 0; tick < 120; tick += 1) {
        flightStep(state, 'hog', held, false, FLOOR, CEILING, 60)
        highest = Math.min(highest, state.y)
      }
      return highest
    }
    expect(peak(true)).toBeLessThan(peak(false))
  })

  it('cuts straight to the marker with the jump cut', (): void => {
    const state: Flight = flight('jumpCut')
    expect(flightStep(state, 'jumpCut', true, true, FLOOR, CEILING, 42)).toBe('cut')
    expect(state.y).toBe(42)
    flightStep(state, 'jumpCut', false, false, FLOOR, CEILING, 99)
    expect(state.y).toBe(42)
  })

  it('flips gravity between the floor and the ceiling with the flip suit', (): void => {
    const state: Flight = flight('flip')
    expect(flightStep(state, 'flip', true, true, FLOOR, CEILING, 60)).toBe('flip')
    fly(state, 'flip', 120, false)
    expect(state.y).toBe(CEILING)
    expect(state.grounded).toBe(true)
    flightStep(state, 'flip', true, true, FLOOR, CEILING, 60)
    fly(state, 'flip', 120, false)
    expect(state.y).toBe(FLOOR - SUIT_SIZES.flip.height)
  })
})

describe('Fix It In Post slot machine', (): void => {
  it('lines up three of a kind on a win', (): void => {
    const random = seeded(3)
    for (let pull: number = 0; pull < 200; pull += 1) {
      const { reels, prize } = rollSlot(100, random)
      expect(prize).not.toBe('none')
      expect(reels).toEqual([prize, prize, prize])
    }
  })

  it('never shows three of a kind on a loss', (): void => {
    const random = seeded(4)
    for (let pull: number = 0; pull < 500; pull += 1) {
      const { reels, prize } = rollSlot(0, random)
      expect(prize).toBe('none')
      expect(reels[0] === reels[1] && reels[1] === reels[2]).toBe(false)
    }
  })

  it('pays out about as often as the admin setting says', (): void => {
    const random = seeded(5)
    let wins: number = 0
    for (let pull: number = 0; pull < 2000; pull += 1)
      if (rollSlot(60, random).prize !== 'none') wins += 1
    expect(wins / 2000).toBeGreaterThan(0.55)
    expect(wins / 2000).toBeLessThan(0.65)
  })
})

describe('Fix It In Post runs', (): void => {
  beforeEach((): void => {
    updateSettings(defaultSettings())
    stage.width = 312
    stage.height = 178
  })
  afterEach((): void => {
    vi.restoreAllMocks()
  })

  it('scores distance and ends with RENDER FAILED after a crash', (): void => {
    vi.spyOn(Math, 'random').mockImplementation(seeded(9))
    const game = JETPACK.create(silentSound, 0)
    let ticks: number = 0
    // Bob up and down without dodging anything until something gets you.
    while (!game.over && ticks < 60 * 300) {
      const held: boolean = Math.floor(ticks / 30) % 2 === 0
      game.update(inputFrame([], held ? ['fly'] : []))
      ticks += 1
    }
    expect(game.over).toBe(true)
    expect(game.score).toBeGreaterThan(0)
    expect(game.summary).toMatch(/^\d+M · \d+ KEYFRAMES/)
    expect(game.endTitle?.('game over')).toBe('RENDER FAILED')
    expect(game.endTitle?.('time')).toBe('PICTURE LOCK!')
  })

  it('gets tougher with each preset', (): void => {
    expect(JETPACK_PRESETS.easy.topSpeed).toBeLessThan(JETPACK_PRESETS.expert.topSpeed)
    expect(JETPACK_PRESETS.easy.spacing).toBeGreaterThan(JETPACK_PRESETS.expert.spacing)
    expect(JETPACK_PRESETS.easy.laserChance).toBeLessThan(JETPACK_PRESETS.expert.laserChance)
  })
})
