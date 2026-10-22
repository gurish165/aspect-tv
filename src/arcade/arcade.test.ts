// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../lib/booth'
import { getSettings, updateSettings } from '../lib/boothStore'
import { Arcade, TICKS_PER_SECOND } from './arcade'
import { CODE_ALPHABET, addScore, clearTodaysScores, recentPlays, topScores } from './scores'
import { inputFrame, run, silentSound } from './testing'

const seconds = (value: number): number => Math.round(value * TICKS_PER_SECOND)

function newArcade(): Arcade {
  return new Arcade(silentSound)
}

function startGame(arcade: Arcade, gameIndex: number): void {
  run(arcade, 1, ['confirm'])
  if (gameIndex > 0) run(arcade, 1, ['right'])
  run(arcade, 1, ['confirm'])
  for (let tick: number = 0; tick < seconds(11) && arcade.screen !== 'playing'; tick += 1) {
    run(arcade, 1)
  }
}

function playUntil(arcade: Arcade, screen: string, limit: number = seconds(60)): void {
  for (let tick: number = 0; tick < limit && arcade.screen !== screen; tick += 1) run(arcade, 1)
}

describe('Arcade flow', (): void => {
  beforeEach((): void => {
    window.localStorage.clear()
    clearTodaysScores()
    updateSettings(defaultSettings())
    // Zero rolls keep food and obstacles in predictable places.
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach((): void => {
    vi.restoreAllMocks()
  })

  it('opens the game picker from the attract screen and backs out', (): void => {
    const arcade = newArcade()
    expect(arcade.screen).toBe('attract')
    run(arcade, 1, ['confirm'])
    expect(arcade.screen).toBe('select')
    run(arcade, 1, ['back'])
    expect(arcade.screen).toBe('attract')
  })

  it('ignores volume keys on the attract screen', (): void => {
    const arcade = newArcade()
    run(arcade, 1, ['volumeUp'])
    expect(arcade.screen).toBe('attract')
  })

  it('returns to the attract screen when the picker is left alone', (): void => {
    const arcade = newArcade()
    run(arcade, 1, ['confirm'])
    run(arcade, seconds(29))
    expect(arcade.screen).toBe('select')
    run(arcade, seconds(2))
    expect(arcade.screen).toBe('attract')
  })

  it('shows the directions for ten seconds, then starts the game on its own', (): void => {
    const arcade = newArcade()
    run(arcade, 1, ['confirm'])
    run(arcade, 1, ['confirm'])
    expect(arcade.screen).toBe('ready')
    run(arcade, seconds(10) - 1)
    expect(arcade.screen).toBe('ready')
    run(arcade, 1)
    expect(arcade.screen).toBe('playing')
  })

  it('counts down, then starts the game, and lets players skip the countdown', (): void => {
    const arcade = newArcade()
    run(arcade, 1, ['confirm'])
    run(arcade, 1, ['confirm'])
    expect(arcade.screen).toBe('ready')
    run(arcade, seconds(1), ['confirm'])
    expect(arcade.screen).toBe('ready')
    run(arcade, 1, ['confirm'])
    expect(arcade.screen).toBe('playing')
  })

  it('takes a scoreless game to the reward screen, logs it, and resets', async (): Promise<void> => {
    const arcade = newArcade()
    startGame(arcade, 0)
    expect(arcade.screen).toBe('playing')
    playUntil(arcade, 'gameOver')
    expect(arcade.screen).toBe('gameOver')
    // A zero score never makes the board, so the result skips initials.
    run(arcade, seconds(7))
    expect(arcade.screen).toBe('reward')
    await Promise.resolve()
    const [logged] = await recentPlays()
    expect(logged?.id).toMatch(new RegExp(`^[${CODE_ALPHABET}]{4}$`))
    expect(logged?.endedBy).toBe('game over')
    expect(logged?.difficulty).toBe('normal')
    run(arcade, seconds(1), ['confirm'])
    expect(arcade.screen).toBe('reward')
    run(arcade, seconds(2))
    run(arcade, 1, ['confirm'])
    expect(arcade.screen).toBe('attract')
  })

  it('asks for initials after a high score and saves them to the board', (): void => {
    const arcade = newArcade()
    startGame(arcade, 1)
    playUntil(arcade, 'gameOver')
    run(arcade, seconds(2))
    run(arcade, 1, ['confirm'])
    expect(arcade.screen).toBe('initials')
    run(arcade, 1, ['up'])
    run(arcade, 1, ['right'])
    run(arcade, 1, ['confirm'])
    run(arcade, 1, ['down'])
    run(arcade, 1, ['confirm'])
    expect(arcade.screen).toBe('reward')
    const [best] = topScores('runner')
    expect(best?.initials).toBe('BA9')
    expect(best?.score).toBeGreaterThan(0)
  })

  it('pauses, resumes, and can end a game early', (): void => {
    const arcade = newArcade()
    startGame(arcade, 0)
    run(arcade, 1, ['back'])
    expect(arcade.screen).toBe('paused')
    run(arcade, 1, ['confirm'])
    expect(arcade.screen).toBe('playing')
    run(arcade, 1, ['back'])
    expect(arcade.screen).toBe('paused')
    run(arcade, 1, ['back'])
    expect(arcade.screen).toBe('gameOver')
  })

  it('abandons a paused game after a while', (): void => {
    const arcade = newArcade()
    startGame(arcade, 0)
    run(arcade, 1, ['back'])
    run(arcade, seconds(46))
    expect(arcade.screen).toBe('attract')
  })

  it('ends the game when the clock runs out and logs why', async (): Promise<void> => {
    // A slow snake needs over seven seconds to reach the wall, so the five-second clock wins.
    updateSettings({ arcade: { timeLimit: 5 }, snake: { startSpeed: 3, topSpeed: 3 } })
    const arcade = newArcade()
    startGame(arcade, 0)
    run(arcade, seconds(5) - 1)
    expect(arcade.screen).toBe('playing')
    run(arcade, 1)
    expect(arcade.screen).toBe('gameOver')
    run(arcade, seconds(7))
    expect(arcade.screen).toBe('reward')
    await Promise.resolve()
    const [logged] = await recentPlays()
    expect(logged?.endedBy).toBe('time')
    expect(logged?.durationSeconds).toBe(5)
    expect(logged?.timeLimit).toBe(5)
    expect(logged?.difficulty).toBe('custom')
  })

  it('lets a game run past a minute with the clock off', (): void => {
    updateSettings({ arcade: { timeLimit: 0 }, snake: { startSpeed: 3, topSpeed: 3 } })
    const arcade = newArcade()
    startGame(arcade, 0)
    // Steer in a rectangle well inside the walls for 70 seconds.
    const loop: readonly ('up' | 'left' | 'down' | 'right')[] = ['up', 'left', 'down', 'right']
    for (let tick: number = 0; tick < seconds(70); tick += 1) {
      const turn = tick % 80 === 0 ? [loop[(tick / 80) % 4]!] : []
      arcade.step(inputFrame(turn))
    }
    expect(arcade.screen).toBe('playing')
  })

  it('pauses a running game when the window loses the keypad', (): void => {
    const arcade = newArcade()
    arcade.suspend()
    expect(arcade.screen).toBe('attract')
    startGame(arcade, 0)
    arcade.suspend()
    expect(arcade.screen).toBe('paused')
  })

  it('changes the shared volume from the keypad unless staff turned that off', (): void => {
    const arcade = newArcade()
    run(arcade, 1, ['volumeUp'])
    expect(getSettings().arcade.volume).toBe(7)
    updateSettings({ arcade: { keypadVolume: false } })
    run(arcade, 1, ['volumeDown'])
    expect(getSettings().arcade.volume).toBe(7)
  })

  it('leaves the reward screen on its own after the configured time', (): void => {
    updateSettings({ arcade: { rewardSeconds: 30 } })
    const arcade = newArcade()
    startGame(arcade, 0)
    playUntil(arcade, 'gameOver')
    run(arcade, seconds(7))
    expect(arcade.screen).toBe('reward')
    run(arcade, seconds(29))
    expect(arcade.screen).toBe('reward')
    run(arcade, seconds(2))
    expect(arcade.screen).toBe('attract')
  })

  it('leaves the reward screen on its own after two minutes', (): void => {
    const arcade = newArcade()
    startGame(arcade, 0)
    playUntil(arcade, 'gameOver')
    run(arcade, seconds(7))
    expect(arcade.screen).toBe('reward')
    run(arcade, seconds(121))
    expect(arcade.screen).toBe('attract')
  })

  it('pauses only with Back, so "." stays free for ducking', (): void => {
    const snake = newArcade()
    startGame(snake, 0)
    run(snake, 1, ['duck'])
    expect(snake.screen).toBe('playing')
    run(snake, 1, ['back'])
    expect(snake.screen).toBe('paused')

    const runner = newArcade()
    startGame(runner, 1)
    run(runner, 1, ['duck'])
    expect(runner.screen).toBe('playing')
    run(runner, 1, ['back'])
    expect(runner.screen).toBe('paused')
  })

  it("opens today's top 10 with Tab and closes it again", (): void => {
    const arcade = newArcade()
    run(arcade, 1, ['leaderboard'])
    expect(arcade.screen).toBe('leaderboard')
    run(arcade, 1, ['leaderboard'])
    expect(arcade.screen).toBe('attract')
    run(arcade, 1, ['leaderboard'])
    run(arcade, seconds(31))
    expect(arcade.screen).toBe('attract')
  })

  it('cycles to the top 10 on its own in corner mode once there are scores', (): void => {
    updateSettings({ display: { mode: 'corner' } })
    const arcade = newArcade()
    run(arcade, seconds(25))
    // No scores yet: nothing to show.
    expect(arcade.screen).toBe('attract')
    addScore('runner', 'ACE', 500)
    run(arcade, 1)
    expect(arcade.screen).toBe('leaderboard')
    run(arcade, seconds(9))
    expect(arcade.screen).toBe('attract')
    // Enter on the looping board goes back home rather than straight into a game.
    run(arcade, seconds(21))
    expect(arcade.screen).toBe('leaderboard')
    run(arcade, 1, ['confirm'])
    expect(arcade.screen).toBe('attract')
  })

  it('stays on the bouncing home screen without looping', (): void => {
    addScore('runner', 'ACE', 500)
    const arcade = newArcade()
    run(arcade, seconds(60))
    expect(arcade.screen).toBe('attract')
  })
})
