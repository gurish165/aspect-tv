// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { CODE_ALPHABET, newPlayCode } from '../arcade/scores'
import {
  TV_BOOST,
  displaySettings,
  pictureFilter,
  RUNNER_PRESETS,
  SNAKE_PRESETS,
  arcadeText,
  defaultSettings,
  fromLegacySearch,
  matchingPreset,
  merge,
  sanitize,
} from './booth'

describe('booth settings', (): void => {
  it('fills in anything missing and clamps out-of-range values', (): void => {
    const settings = sanitize({ screen: { uiScale: 999, stretch: 'wide' }, snake: { growth: -4 } })
    expect(settings.screen.uiScale).toBe(140)
    expect(settings.screen.stretch).toBe(1)
    expect(settings.snake.growth).toBe(1)
    expect(settings.runner).toEqual(defaultSettings().runner)
  })

  it('treats garbage as the defaults', (): void => {
    expect(sanitize(null)).toEqual(defaultSettings())
    expect(sanitize('nope')).toEqual(defaultSettings())
  })

  it('keeps reward tiers in rising order', (): void => {
    const settings = sanitize({ rewards: { snake: [50, 20, 20, 300], runner: [1, 2] } })
    expect(settings.rewards.snake).toEqual([50, 51, 52, 300])
    expect(settings.rewards.runner).toEqual(defaultSettings().rewards.runner)
  })

  it('never lets top speed fall below start speed', (): void => {
    const settings = sanitize({ snake: { startSpeed: 14, topSpeed: 6 } })
    expect(settings.snake.topSpeed).toBe(14)
  })

  it('merges one section without touching the rest', (): void => {
    const merged = merge(defaultSettings(), { arcade: { timeLimit: 30 } })
    expect(merged.arcade.timeLimit).toBe(30)
    expect(merged.arcade.headline).toBe(defaultSettings().arcade.headline)
    expect(merged.snake).toEqual(defaultSettings().snake)
  })

  it('limits text to what the pixel font can draw', (): void => {
    expect(arcadeText('Win “big” at Aspect™!', 'X', 34)).toBe('WIN BIG AT ASPECT!')
    expect(arcadeText('A very long headline indeed', 'X', 10)).toBe('A VERY LON')
    expect(arcadeText(42, 'FALLBACK', 10)).toBe('FALLBACK')
  })

  it('names the preset the values match, or custom', (): void => {
    expect(matchingPreset(SNAKE_PRESETS, defaultSettings().snake)).toBe('normal')
    expect(
      matchingPreset(RUNNER_PRESETS, { ...defaultSettings().runner, ...RUNNER_PRESETS.hard }),
    ).toBe('hard')
    expect(matchingPreset(SNAKE_PRESETS, { ...SNAKE_PRESETS.easy, growth: 4 })).toBe('custom')
  })

  it('carries over logo settings from an older URL', (): void => {
    const settings = fromLegacySearch('?logoWidth=50&logoHeight=33.3&speed=1.45')
    expect(settings.display.logoWidth).toBe(50)
    expect(settings.display.logoHeight).toBe(33.3)
    expect(settings.display.speed).toBe(1.45)
    expect(settings.arcade).toEqual(defaultSettings().arcade)
  })
})

describe('home screen settings', (): void => {
  it('accepts only known modes and corners', (): void => {
    const settings = sanitize({ display: { mode: 'corner', corner: 'middle' } })
    expect(settings.display.mode).toBe('corner')
    expect(settings.display.corner).toBe('bottom-right')
    expect(sanitize({ display: { mode: 'spin' } }).display.mode).toBe('bounce')
  })

  it('moves a saved old default to the new tagline but keeps custom text', (): void => {
    expect(sanitize({ arcade: { subhead: 'PLAY TO WIN GENAI CREDITS' } }).arcade.subhead).toBe(
      'PLAY TO WIN CREDITS',
    )
    expect(sanitize({ arcade: { subhead: 'WIN BIG' } }).arcade.subhead).toBe('WIN BIG')
    expect(sanitize({ runner: { title: 'RENDER RUSH' } }).runner.title).toBe('ON SET')
    expect(sanitize({ runner: { title: 'MY RUNNER' } }).runner.title).toBe('MY RUNNER')
  })
})

describe('claim codes', (): void => {
  it('uses four unambiguous characters', (): void => {
    for (let index: number = 0; index < 200; index += 1) {
      const code: string = newPlayCode(new Set())
      expect(code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{4}$`))
    }
    expect(CODE_ALPHABET).not.toMatch(/[AEIOU01]/)
  })

  it('never repeats a code already used', (): void => {
    const rolls: number[] = [0, 0, 0, 0, 0, 0, 0, 0.99]
    const random = (): number => rolls.shift() ?? 0.5
    expect(newPlayCode(new Set(['BBBB']), random)).not.toBe('BBBB')
  })
})

describe('picture settings', (): void => {
  it('leaves the picture alone by default', (): void => {
    const settings = sanitize({})
    expect(pictureFilter(settings.picture)).toBeUndefined()
    expect(displaySettings(settings.display, settings.picture).crt).toBe(settings.display.crt)
  })

  it('boosts brightness, contrast, and color, and drops the simulated CRT in TV mode', (): void => {
    const settings = sanitize({ picture: TV_BOOST, display: { crt: 1 } })
    expect(pictureFilter(settings.picture)).toBe('brightness(135%) contrast(125%) saturate(120%)')
    expect(displaySettings(settings.display, settings.picture).crt).toBe(0)
  })

  it('clamps picture values', (): void => {
    const { picture } = sanitize({ picture: { brightness: 900, contrast: -5, tvMode: 'yes' } })
    expect(picture.brightness).toBe(250)
    expect(picture.contrast).toBe(50)
    expect(picture.tvMode).toBe(false)
  })
})
