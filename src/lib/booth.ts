import { LOGO_ASPECT_RATIO } from './bounce'
import { type KeyBindings, defaultKeys, sanitizeKeys } from './keys'
import { DISPLAY_CONTROLS, DisplaySettings } from './settings'

// Everything staff can tune from the admin window. The TV window reads the same object, so a
// change shows up on the TV right away. Values are plain JSON so they can cross windows.

export type DifficultyName = 'easy' | 'normal' | 'hard' | 'expert'
export type Preset = DifficultyName | 'custom'

export type HomeMode = 'bounce' | 'corner'
export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export const HOME_MODES: readonly HomeMode[] = ['bounce', 'corner']
export const CORNERS: readonly Corner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

export interface DisplaySection {
  /** The home screen: the big bouncing logo, or a corner logo over an animated neon scene. */
  mode: HomeMode
  /** Where the logo sits in corner mode. */
  corner: Corner
  logoWidth: number
  logoHeight: number
  speed: number
  crt: number
  scanSpacing: number
  glow: number
  padding: number
  paused: boolean
}

export interface ScreenSection {
  /** Size of everything in the arcade, in percent. Bigger means fewer, larger pixels. */
  uiScale: number
  /** Horizontal stretch for the arcade, to undo a TV that squishes or widens the picture. */
  stretch: number
  /** Inset from the window's edges, in percent, for TVs that crop the picture (overscan). */
  marginX: number
  marginY: number
  /** Moves the arcade picture, in percent of the window, for TVs that are off-center. */
  shiftX: number
  shiftY: number
  /** Draws a calibration pattern over the arcade for lining up the TV. */
  testPattern: boolean
}

export interface ArcadeSection {
  /** Seconds per game; 0 turns the clock off. */
  timeLimit: number
  volume: number
  keypadVolume: boolean
  headline: string
  subhead: string
  /** Scrolls along the tape across the top of the home screen. */
  eventName: string
  handoffLine1: string
  handoffLine2: string
  rewardSeconds: number
}

export interface SnakeSection {
  title: string
  tagline: string
  /** Moves per second at the start. */
  startSpeed: number
  topSpeed: number
  /** Files eaten between speed-ups. */
  speedupEvery: number
  /** Moves per second added at each speed-up. */
  speedupBy: number
  /** Segments added per file. */
  growth: number
  /** Size of one board square, in arcade pixels. */
  cellSize: number
}

export interface RunnerSection {
  title: string
  tagline: string
  startSpeed: number
  topSpeed: number
  /** Seconds to reach top speed. Tougher obstacles also unlock along the way. */
  rampSeconds: number
  /** Extra room between obstacles. The game always leaves enough room to land a jump. */
  spacing: number
  /** Size of the runner and obstacles. */
  spriteScale: number
}

export interface RewardsSection {
  /** Minimum score for Bronze, Silver, Gold, and Legend. Rookie always starts at 0. */
  snake: number[]
  runner: number[]
}

/** Picture adjustments for a real TV, which can be darker and softer than a laptop screen. */
export interface PictureSection {
  /** Turns off the simulated CRT (scanlines, color fringes, vignette) that darken a real CRT. */
  tvMode: boolean
  /** In percent; 100 leaves the picture as drawn. */
  brightness: number
  contrast: number
  saturation: number
  /** Thicker, brighter walls and outlines so edges read from a distance. */
  boldEdges: boolean
}

export interface AdminSection {
  /** Seconds of admin-window inactivity before the keypad goes back to the game; 0 is off. */
  autoReturnSeconds: number
}

export interface BoothSettings {
  display: DisplaySection
  screen: ScreenSection
  arcade: ArcadeSection
  snake: SnakeSection
  runner: RunnerSection
  rewards: RewardsSection
  picture: PictureSection
  keys: KeyBindings
  admin: AdminSection
}

export type SectionName = keyof BoothSettings
export type BoothPatch = { [Section in SectionName]?: Partial<BoothSettings[Section]> }

type SnakeDifficulty = Pick<
  SnakeSection,
  'startSpeed' | 'topSpeed' | 'speedupEvery' | 'speedupBy' | 'growth'
>
type RunnerDifficulty = Pick<RunnerSection, 'startSpeed' | 'topSpeed' | 'rampSeconds' | 'spacing'>

// Easy matches the first field build. Normal aims for a 30-60 second game for a decent player.
export const SNAKE_PRESETS: Record<DifficultyName, SnakeDifficulty> = {
  easy: { startSpeed: 6.5, topSpeed: 12, speedupEvery: 5, speedupBy: 1.2, growth: 1 },
  normal: { startSpeed: 8, topSpeed: 15, speedupEvery: 3, speedupBy: 1.2, growth: 1 },
  hard: { startSpeed: 10, topSpeed: 18, speedupEvery: 2, speedupBy: 1.5, growth: 2 },
  expert: { startSpeed: 12, topSpeed: 22, speedupEvery: 2, speedupBy: 2, growth: 3 },
}

export const RUNNER_PRESETS: Record<DifficultyName, RunnerDifficulty> = {
  easy: { startSpeed: 2.4, topSpeed: 6, rampSeconds: 110, spacing: 1.2 },
  normal: { startSpeed: 3.2, topSpeed: 7.5, rampSeconds: 45, spacing: 0.8 },
  hard: { startSpeed: 4, topSpeed: 8.5, rampSeconds: 30, spacing: 0.6 },
  expert: { startSpeed: 5, topSpeed: 9.5, rampSeconds: 20, spacing: 0.4 },
}

export const DIFFICULTIES: readonly DifficultyName[] = ['easy', 'normal', 'hard', 'expert']

const DISPLAY_DEFAULTS: DisplaySettings = new DisplaySettings()

export function defaultSettings(): BoothSettings {
  return {
    display: {
      logoWidth: DISPLAY_DEFAULTS.logoWidth,
      logoHeight: DISPLAY_DEFAULTS.logoHeight,
      speed: DISPLAY_DEFAULTS.speed,
      crt: DISPLAY_DEFAULTS.crt,
      scanSpacing: DISPLAY_DEFAULTS.scanSpacing,
      glow: DISPLAY_DEFAULTS.glow,
      padding: DISPLAY_DEFAULTS.padding,
      paused: false,
      mode: 'bounce',
      corner: 'bottom-right',
    },
    screen: {
      uiScale: 100,
      stretch: 1,
      marginX: 0,
      marginY: 0,
      shiftX: 0,
      shiftY: 0,
      testPattern: false,
    },
    arcade: {
      timeLimit: 60,
      volume: 6,
      keypadVolume: true,
      headline: 'ASPECT ARCADE',
      subhead: 'PLAY TO WIN CREDITS',
      eventName: 'NAB NYC 2026',
      handoffLine1: 'SHOW THIS SCREEN TO AN ASPECT',
      handoffLine2: 'TEAM MEMBER TO CLAIM YOUR PRIZE',
      rewardSeconds: 120,
    },
    snake: {
      title: 'FILE FEAST',
      tagline: 'EAT FILES. GROW LONG.',
      ...SNAKE_PRESETS.normal,
      cellSize: 8,
    },
    runner: {
      title: 'ON SET',
      tagline: 'JUMP CABLES. DUCK MICS',
      ...RUNNER_PRESETS.normal,
      spriteScale: 1,
    },
    rewards: { snake: [40, 100, 180, 280], runner: [200, 500, 900, 1500] },
    picture: { tvMode: false, brightness: 100, contrast: 100, saturation: 100, boldEdges: false },
    keys: defaultKeys(),
    admin: { autoReturnSeconds: 20 },
  }
}

/** One click in the admin window: a brighter, punchier picture with bold edges for a CRT. */
export const TV_BOOST: PictureSection = {
  tvMode: true,
  brightness: 135,
  contrast: 125,
  saturation: 120,
  boldEdges: true,
}

// Slider ranges. The admin window builds its controls from these, and every value that comes
// in from storage or another window is clamped to them.

export interface NumberField<Section extends SectionName = SectionName> {
  section: Section
  key: keyof BoothSettings[Section] & string
  label: string
  minimum: number
  maximum: number
  step: number
  unit: string
  help?: string
  /** Shown instead of the number at the minimum, e.g. "Off". */
  minimumLabel?: string
}

function field<Section extends SectionName>(
  section: Section,
  key: keyof BoothSettings[Section] & string,
  label: string,
  minimum: number,
  maximum: number,
  step: number,
  unit: string,
  extra: Pick<NumberField, 'help' | 'minimumLabel'> = {},
): NumberField {
  return { section, key, label, minimum, maximum, step, unit, ...extra } as NumberField
}

export const NUMBER_FIELDS: readonly NumberField[] = [
  ...DISPLAY_CONTROLS.map((control): NumberField =>
    field(
      'display',
      control.property,
      control.label,
      control.minimum,
      control.maximum,
      control.step,
      control.unit,
    ),
  ),
  field('screen', 'uiScale', 'Arcade size', 75, 140, 1, '%', {
    help: 'Makes text, the snake, and the runner bigger or smaller. 100% fits the locked booth window.',
  }),
  field('screen', 'stretch', 'Horizontal stretch', 0.75, 1.35, 0.01, '×', {
    help: 'Above 1 widens the arcade. Use it if the TV squishes the picture. The logo keeps its own width and height below.',
  }),
  field('screen', 'marginX', 'Side margin', 0, 15, 0.5, '%', {
    help: 'Pulls the arcade in from the left and right edges if the TV crops them.',
  }),
  field('screen', 'marginY', 'Top and bottom margin', 0, 15, 0.5, '%', {
    help: 'Pulls the arcade in from the top and bottom if the TV crops them.',
  }),
  field('screen', 'shiftX', 'Move left or right', -10, 10, 0.5, '%'),
  field('screen', 'shiftY', 'Move up or down', -10, 10, 0.5, '%'),
  field('arcade', 'timeLimit', 'Time limit per game', 0, 180, 5, ' s', {
    minimumLabel: 'Off',
    help: 'The game ends when the clock runs out. Off lets good players keep going.',
  }),
  field('arcade', 'volume', 'Volume', 0, 10, 1, '', { minimumLabel: 'Mute' }),
  field('arcade', 'rewardSeconds', 'Reward screen time', 20, 300, 5, ' s', {
    help: 'How long the reward screen stays up before returning to the start.',
  }),
  field('snake', 'startSpeed', 'Start speed', 3, 20, 0.5, ' moves/s'),
  field('snake', 'topSpeed', 'Top speed', 5, 30, 0.5, ' moves/s'),
  field('snake', 'speedupEvery', 'Speed up every', 1, 10, 1, ' files'),
  field('snake', 'speedupBy', 'Speed-up amount', 0, 4, 0.1, ' moves/s'),
  field('snake', 'growth', 'Segments added per file', 1, 5, 1, ''),
  field('snake', 'cellSize', 'Square size', 5, 14, 1, ' px', {
    help: 'Bigger squares make a bigger snake on a smaller board. Applies from the next game.',
  }),
  field('runner', 'startSpeed', 'Start speed', 1.5, 8, 0.1, '×'),
  field('runner', 'topSpeed', 'Top speed', 3, 12, 0.1, '×'),
  field('runner', 'rampSeconds', 'Seconds to top speed', 10, 180, 5, ' s', {
    help: 'Tougher obstacles also unlock over this time.',
  }),
  field('runner', 'spacing', 'Obstacle spacing', 0.2, 2, 0.05, '×', {
    help: 'Lower packs obstacles closer. There is always room to land a jump.',
  }),
  field('runner', 'spriteScale', 'Runner size', 1, 2, 1, '×', {
    help: 'Doubles the runner and obstacles. Applies from the next game.',
  }),
  field('picture', 'brightness', 'Brightness', 50, 250, 5, '%'),
  field('picture', 'contrast', 'Contrast', 50, 250, 5, '%'),
  field('picture', 'saturation', 'Color', 0, 250, 5, '%', {
    help: 'Above 100% makes colors stronger, which helps them hold up on an older TV.',
  }),
  field('admin', 'autoReturnSeconds', 'Give keypad back after', 0, 120, 5, ' s', {
    minimumLabel: 'Never',
    help: 'After this long without mouse or keyboard use here, the game window takes the keypad back.',
  }),
]

export const TEXT_LIMITS: Record<string, number> = {
  title: 14,
  tagline: 24,
  headline: 20,
  subhead: 32,
  eventName: 24,
  handoffLine1: 32,
  handoffLine2: 32,
}

export function formatNumber(field: NumberField, value: number): string {
  if (field.minimumLabel && value <= field.minimum) return field.minimumLabel
  if (field.unit === '×') return `${value.toFixed(2)}×`
  const decimals: number = field.step < 1 ? (String(field.step).split('.')[1]?.length ?? 1) : 0
  return `${value.toFixed(decimals)}${field.unit}`
}

// Sanitizing

function clampNumber(value: unknown, fallback: number, field?: NumberField): number {
  const number: number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  if (!field) return number
  return Math.min(field.maximum, Math.max(field.minimum, number))
}

/** Text the arcade's pixel font can draw: uppercase letters, digits, and its punctuation. */
export function arcadeText(value: unknown, fallback: string, limit: number): string {
  if (typeof value !== 'string') return fallback
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9 .,:;!?'"\-+/#%&()*=<>_@$]/g, '')
    .slice(0, limit)
}

function thresholds(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value) || value.length !== fallback.length) return fallback
  let previous: number = 0
  return value.map((entry: unknown, index: number): number => {
    const number: number = Math.round(clampNumber(entry, fallback[index] ?? 0))
    previous = Math.max(previous + 1, number)
    return previous
  })
}

/** Settings whose value is one of a fixed list. */
const CHOICES: Record<string, readonly string[]> = {
  'display.mode': HOME_MODES,
  'display.corner': CORNERS,
}

/** Old defaults that saved settings may still hold; they move to the current default. */
const RETIRED_DEFAULTS: Record<string, readonly string[]> = {
  'arcade.subhead': ['PLAY TO WIN GENAI CREDITS'],
  'runner.title': ['RENDER RUSH', 'ASPECT RUN'],
  'runner.tagline': ['JUMP BUGS. GET CREDITS'],
}

/** Fills in anything missing and clamps everything to its allowed range. */
export function sanitize(input: unknown): BoothSettings {
  const defaults: BoothSettings = defaultSettings()
  const source: Partial<Record<SectionName, Record<string, unknown>>> =
    input && typeof input === 'object'
      ? (input as Record<SectionName, Record<string, unknown>>)
      : {}
  const result: BoothSettings = defaultSettings()

  for (const numberField of NUMBER_FIELDS) {
    const section: Record<string, unknown> = result[numberField.section] as never
    const raw: unknown = source[numberField.section]?.[numberField.key]
    const fallback: number = (defaults[numberField.section] as never)[numberField.key]
    section[numberField.key] =
      raw === undefined ? fallback : clampNumber(raw, fallback, numberField)
  }
  for (const [sectionName, section] of Object.entries(result) as [SectionName, object][]) {
    if (sectionName === 'keys') continue
    for (const [key, fallback] of Object.entries(section)) {
      const raw: unknown = source[sectionName]?.[key]
      const choices: readonly string[] | undefined = CHOICES[`${sectionName}.${key}`]
      if (choices) {
        ;(section as Record<string, unknown>)[key] = choices.includes(raw as string)
          ? raw
          : fallback
      } else if (RETIRED_DEFAULTS[`${sectionName}.${key}`]?.includes(raw as string)) {
        ;(section as Record<string, unknown>)[key] = fallback
      } else if (typeof fallback === 'string') {
        ;(section as Record<string, unknown>)[key] = arcadeText(
          raw,
          fallback,
          TEXT_LIMITS[key] ?? 32,
        )
      } else if (typeof fallback === 'boolean') {
        ;(section as Record<string, unknown>)[key] = typeof raw === 'boolean' ? raw : fallback
      }
    }
  }
  result.snake.topSpeed = Math.max(result.snake.topSpeed, result.snake.startSpeed)
  result.runner.topSpeed = Math.max(result.runner.topSpeed, result.runner.startSpeed)
  result.rewards.snake = thresholds(source.rewards?.snake, defaults.rewards.snake)
  result.rewards.runner = thresholds(source.rewards?.runner, defaults.rewards.runner)
  result.keys = sanitizeKeys(source.keys)
  return result
}

export function merge(settings: BoothSettings, patch: BoothPatch): BoothSettings {
  const next: Record<string, unknown> = { ...settings }
  for (const [section, values] of Object.entries(patch)) {
    next[section] = { ...(next[section] as object), ...values }
  }
  return sanitize(next)
}

/** Settings from an older desktop build, which kept display settings in the page URL. */
export function fromLegacySearch(search: string): BoothSettings {
  const legacy: DisplaySettings = DisplaySettings.fromSearch(search)
  const settings: BoothSettings = defaultSettings()
  for (const control of DISPLAY_CONTROLS) {
    settings.display[control.property] = legacy[control.property]
  }
  return settings
}

/**
 * The logo and CRT settings the TV draws with. Real TV mode turns the simulated CRT off, since a
 * real CRT already has scanlines and the extra ones only darken and blur the picture.
 */
export function displaySettings(
  section: DisplaySection,
  picture?: PictureSection,
): DisplaySettings {
  return Object.assign(new DisplaySettings(), {
    logoWidth: section.logoWidth,
    logoHeight: section.logoHeight,
    speed: section.speed,
    crt: picture?.tvMode ? 0 : section.crt,
    scanSpacing: section.scanSpacing,
    glow: section.glow,
    padding: section.padding,
  })
}

/** The CSS filter for the picture settings, or undefined when they leave the picture alone. */
export function pictureFilter(picture: PictureSection): string | undefined {
  if (picture.brightness === 100 && picture.contrast === 100 && picture.saturation === 100) {
    return undefined
  }
  return `brightness(${picture.brightness}%) contrast(${picture.contrast}%) saturate(${picture.saturation}%)`
}

/** Logo height that keeps the original proportions for a given width. */
export function proportionalLogoHeight(width: number): number {
  return Math.round((width / LOGO_ASPECT_RATIO) * 10) / 10
}

/** The preset a set of difficulty values matches, or 'custom'. */
export function matchingPreset<Values extends object>(
  presets: Record<DifficultyName, Values>,
  section: Values,
): Preset {
  return (
    DIFFICULTIES.find((name: DifficultyName): boolean =>
      Object.entries(presets[name]).every(
        ([key, value]): boolean =>
          Math.abs((section as Record<string, number>)[key]! - (value as number)) < 1e-6,
      ),
    ) ?? 'custom'
  )
}
