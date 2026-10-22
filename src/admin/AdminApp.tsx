import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import {
  DIFFICULTIES,
  JETPACK_PRESETS,
  NUMBER_FIELDS,
  RUNNER_PRESETS,
  SHOOTER_PRESETS,
  SNAKE_PRESETS,
  TV_BOOST,
  matchingPreset,
  type BoothSettings,
  type Preset,
  type SectionName,
} from '../lib/booth'
import { resetSettings, updateSettings, useBoothSettings } from '../lib/boothStore'
import { ChoiceSetting, NumberSetting, TextSetting, ToggleSetting } from './fields'
import { FEEL_KEYS, JetpackFeel } from './JetpackFeel'
import { KeysPanel } from './KeysPanel'
import { PlaysPanel } from './PlaysPanel'
import { RewardsPanel } from './RewardsPanel'
import { WindowPanel } from './WindowPanel'

type Tab = 'plays' | 'difficulty' | 'rewards' | 'arcade' | 'keys' | 'tv' | 'logo' | 'window'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'plays', label: 'Plays & codes' },
  { id: 'difficulty', label: 'Difficulty' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'arcade', label: 'Arcade & text' },
  { id: 'keys', label: 'Keys' },
  { id: 'tv', label: 'TV fit & picture' },
  { id: 'logo', label: 'Home screen' },
  { id: 'window', label: 'Window & scores' },
]
const TAB_KEY: string = 'aspect-admin-tab'

interface Focus {
  game: boolean
  admin: boolean
}

function fields(section: SectionName, ...keys: string[]): ReactElement[] {
  return NUMBER_FIELDS.filter(
    (field): boolean =>
      field.section === section && (keys.length === 0 || keys.includes(field.key)),
  ).map((field): ReactElement => (
    <NumberSetting key={`${field.section}.${field.key}`} field={field} />
  ))
}

function readTab(): Tab {
  try {
    const stored: string | null = window.localStorage.getItem(TAB_KEY)
    if (TABS.some((tab): boolean => tab.id === stored)) return stored as Tab
  } catch {
    // Start on the first tab.
  }
  return 'plays'
}

/** Tracks which window has the keypad, and hands it back to the game after a quiet spell. */
function useKeypadFocus(autoReturnSeconds: number): {
  focus: Focus | null
  returnsIn: number | null
} {
  const desktop: Window['aspectDesktop'] = window.aspectDesktop
  const [focus, setFocus] = useState<Focus | null>(null)
  const [now, setNow] = useState<number>(Date.now())
  const lastActivity = useRef<number>(Date.now())

  useEffect((): (() => void) | undefined => {
    if (!desktop) return
    void desktop.getFocus().then(setFocus)
    return desktop.onFocus(setFocus)
  }, [desktop])

  useEffect((): (() => void) => {
    const active = (): void => {
      lastActivity.current = Date.now()
    }
    const timer: number = window.setInterval((): void => setNow(Date.now()), 250)
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'focus'] as const) {
      window.addEventListener(type, active, { passive: true })
    }
    return (): void => {
      window.clearInterval(timer)
      for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'focus'] as const) {
        window.removeEventListener(type, active)
      }
    }
  }, [])

  const counting: boolean = Boolean(desktop && focus?.admin && autoReturnSeconds > 0)
  const returnsIn: number | null = counting
    ? Math.max(0, Math.ceil(autoReturnSeconds - (now - lastActivity.current) / 1000))
    : null
  useEffect((): void => {
    if (returnsIn === 0) desktop?.focusGame()
  }, [returnsIn, desktop])
  return { focus, returnsIn }
}

function FocusBanner({ settings }: { settings: BoothSettings }): ReactElement {
  const desktop: Window['aspectDesktop'] = window.aspectDesktop
  const { focus, returnsIn } = useKeypadFocus(settings.admin.autoReturnSeconds)
  const [windowState, setWindowState] = useState<WindowState | null>(null)

  useEffect((): (() => void) | undefined => {
    if (!desktop) return
    void desktop.getWindowState().then(setWindowState)
    return desktop.onWindowState(setWindowState)
  }, [desktop])

  useEffect((): void => {
    const keypad: string = !desktop
      ? 'browser'
      : focus?.game
        ? 'game'
        : focus?.admin
          ? 'admin'
          : 'none'
    document.documentElement.dataset.keypad = keypad
  }, [desktop, focus])

  const giveBack = (): void => desktop?.focusGame()
  let banner: ReactElement
  if (!desktop) {
    banner = (
      <div className="focus-banner" data-state="browser">
        <strong>Browser mode.</strong> Click the TV tab to give it the keyboard. In the desktop app,
        this panel shows which window has the keypad.
      </div>
    )
  } else if (focus?.game) {
    banner = (
      <div className="focus-banner" data-state="game" role="status">
        <span className="focus-light" />
        <div>
          <strong>Keypad → GAME</strong>
          <span>Players can play. Clicking anywhere in this window takes the keypad away.</span>
        </div>
      </div>
    )
  } else {
    banner = (
      <div className="focus-banner" data-state={focus?.admin ? 'admin' : 'none'} role="alert">
        <span className="focus-light" />
        <div>
          <strong>{focus?.admin ? 'Keypad → ADMIN (this window)' : 'Keypad → another app'}</strong>
          <span>
            Players&apos; key presses won&apos;t reach the game, and a game in progress is paused.
            {returnsIn !== null &&
              ` Giving it back in ${returnsIn} s unless you keep working here.`}
          </span>
        </div>
        <button type="button" className="primary-button" onClick={giveBack}>
          Give keypad to game <kbd>⌘G</kbd>
        </button>
      </div>
    )
  }

  return (
    <div className="banner-stack">
      {banner}
      {windowState?.adminOverTv && (
        <div className="warning-banner" role="alert">
          This window overlaps the TV window, so players can see it. Move it off to the side.
        </div>
      )}
      {settings.screen.testPattern && (
        <div className="warning-banner">
          The TV is showing the test pattern.
          <button
            type="button"
            className="quiet-button"
            onClick={(): void => updateSettings({ screen: { testPattern: false } })}
          >
            Hide test pattern
          </button>
        </div>
      )}
    </div>
  )
}

function PresetPicker({
  label,
  current,
  onPick,
}: {
  label: string
  current: Preset
  onPick: (name: (typeof DIFFICULTIES)[number]) => void
}): ReactElement {
  return (
    <div className="preset-picker" role="group" aria-label={`${label} difficulty`}>
      {DIFFICULTIES.map((name): ReactElement => (
        <button
          type="button"
          key={name}
          aria-pressed={current === name}
          onClick={(): void => onPick(name)}
        >
          {name[0]!.toUpperCase() + name.slice(1)}
        </button>
      ))}
      <span className="preset-custom" data-active={current === 'custom'}>
        Custom
      </span>
    </div>
  )
}

function Section({
  title,
  description,
  onReset,
  children,
}: {
  title: string
  description?: string
  onReset?: () => void
  children: React.ReactNode
}): ReactElement {
  return (
    <section className="admin-card">
      <header>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {onReset && (
          <button type="button" className="quiet-button" onClick={onReset}>
            Reset
          </button>
        )}
      </header>
      {children}
    </section>
  )
}

export function AdminApp(): ReactElement {
  const settings: BoothSettings = useBoothSettings()
  const [tab, setTab] = useState<Tab>(readTab)

  const choose = useCallback((next: Tab): void => {
    setTab(next)
    try {
      window.localStorage.setItem(TAB_KEY, next)
    } catch {
      // The tab just won't be remembered.
    }
  }, [])

  const snakePreset: Preset = matchingPreset(SNAKE_PRESETS, settings.snake)
  const runnerPreset: Preset = matchingPreset(RUNNER_PRESETS, settings.runner)
  const shooterPreset: Preset = matchingPreset(SHOOTER_PRESETS, settings.shooter)
  const jetpackPreset: Preset = matchingPreset(JETPACK_PRESETS, settings.jetpack)

  return (
    <div className="admin">
      <FocusBanner settings={settings} />
      <div className="admin-body">
        <nav className="admin-tabs" aria-label="Admin sections">
          <p className="admin-brand">Aspect TV admin</p>
          {TABS.map(({ id, label }): ReactElement => (
            <button
              type="button"
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              onClick={(): void => choose(id)}
            >
              {label}
            </button>
          ))}
          <p className="admin-note">
            Changes apply to the TV right away and are saved on this laptop.
          </p>
        </nav>
        <main className="admin-main">
          {tab === 'plays' && <PlaysPanel settings={settings} />}

          {tab === 'difficulty' && (
            <>
              <Section
                title={`Snake · ${settings.snake.title}`}
                description="Speed changes apply during a game. Square size applies from the next game."
              >
                <PresetPicker
                  label="Snake"
                  current={snakePreset}
                  onPick={(name): void => updateSettings({ snake: SNAKE_PRESETS[name] })}
                />
                <div className="field-grid">{fields('snake')}</div>
              </Section>
              <Section
                title={`Runner · ${settings.runner.title}`}
                description="Speed and spacing apply during a game. Runner size applies from the next game."
              >
                <PresetPicker
                  label="Runner"
                  current={runnerPreset}
                  onPick={(name): void => updateSettings({ runner: RUNNER_PRESETS[name] })}
                />
                <div className="field-grid">{fields('runner')}</div>
              </Section>
              <Section
                title={`Shooter · ${settings.shooter.title}`}
                description="Dives and enemy fire apply during a game. Lives apply from the next game. With the clock off, the game ends when the last cab is hit."
              >
                <PresetPicker
                  label="Shooter"
                  current={shooterPreset}
                  onPick={(name): void => updateSettings({ shooter: SHOOTER_PRESETS[name] })}
                />
                <div className="field-grid">{fields('shooter')}</div>
              </Section>
              <Section
                title={`Jetpack · ${settings.jetpack.title}`}
                description="Presets set the speed, spacing, lasers, and missiles. Suits, play tokens, and the slot machine have their own settings below the preset values. Everything applies during a game."
              >
                <PresetPicker
                  label="Jetpack"
                  current={jetpackPreset}
                  onPick={(name): void => updateSettings({ jetpack: JETPACK_PRESETS[name] })}
                />
                <div className="field-grid">
                  {fields(
                    'jetpack',
                    ...NUMBER_FIELDS.filter(
                      (field): boolean =>
                        field.section === 'jetpack' && !FEEL_KEYS.includes(field.key),
                    ).map((field): string => field.key),
                  )}
                </div>
              </Section>
              <Section
                title={`Jetpack feel · ${settings.jetpack.title}`}
                description="How the jetpack climbs and falls. Changes apply right away, so you can tune it while someone plays."
              >
                <JetpackFeel />
              </Section>
              <Section
                title="Game clock"
                description="The surest way to keep the line moving. Applies to every game."
              >
                <div className="field-grid">{fields('arcade', 'timeLimit')}</div>
              </Section>
            </>
          )}

          {tab === 'rewards' && <RewardsPanel settings={settings} />}

          {tab === 'arcade' && (
            <>
              <Section title="Game names">
                <div className="field-grid">
                  <TextSetting section="snake" name="title" label="Snake title" />
                  <TextSetting section="snake" name="tagline" label="Snake tagline" />
                  <TextSetting section="runner" name="title" label="Runner title" />
                  <TextSetting section="runner" name="tagline" label="Runner tagline" />
                  <TextSetting section="shooter" name="title" label="Shooter title" />
                  <TextSetting section="shooter" name="tagline" label="Shooter tagline" />
                  <TextSetting section="jetpack" name="title" label="Jetpack title" />
                  <TextSetting section="jetpack" name="tagline" label="Jetpack tagline" />
                </div>
              </Section>
              <Section
                title="Start and reward screens"
                description="The pixel font draws capital letters, numbers, and basic punctuation."
              >
                <div className="field-grid">
                  <TextSetting section="arcade" name="eventName" label="Top tape (event name)" />
                  <TextSetting section="arcade" name="headline" label="Start screen headline" />
                  <TextSetting section="arcade" name="subhead" label="Start screen tagline" />
                  <TextSetting section="arcade" name="handoffLine1" label="Prize handoff, line 1" />
                  <TextSetting section="arcade" name="handoffLine2" label="Prize handoff, line 2" />
                </div>
              </Section>
              <Section title="Sound and timing">
                <div className="field-grid">
                  {fields('arcade', 'volume', 'rewardSeconds')}
                  <ToggleSetting
                    section="arcade"
                    name="keypadVolume"
                    label="Players can change volume with + and −"
                  />
                </div>
              </Section>
            </>
          )}

          {tab === 'keys' && <KeysPanel />}

          {tab === 'tv' && (
            <>
              <Section
                title="Picture"
                description="For a real TV that looks darker or softer than this screen. Real TV mode turns off the simulated scanlines, color fringes, and dark corners, which a real CRT already has. Bold edges draws thick, bright walls in File Feast and a thicker floor in On Set."
                onReset={(): void => resetSettings('picture')}
              >
                <div className="button-row picture-presets">
                  <button
                    type="button"
                    className="secondary-button"
                    aria-pressed={Object.entries(TV_BOOST).every(
                      ([key, value]): boolean =>
                        settings.picture[key as keyof typeof TV_BOOST] === value,
                    )}
                    onClick={(): void => updateSettings({ picture: TV_BOOST })}
                  >
                    Boost for the CRT
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={(): void => resetSettings('picture')}
                  >
                    As drawn
                  </button>
                </div>
                <div className="field-grid">
                  <ToggleSetting
                    section="picture"
                    name="tvMode"
                    label="Real TV mode (no simulated CRT)"
                  />
                  <ToggleSetting section="picture" name="boldEdges" label="Bold edges" />
                  {fields('picture')}
                </div>
              </Section>
              <Section
                title="Fit the arcade to the TV"
                description="Turn on the test pattern, then adjust until the circle looks round and all four red corners show on the TV. A bigger arcade size makes every pixel bigger, which also helps fine detail on a soft TV."
                onReset={(): void => resetSettings('screen')}
              >
                <ToggleSetting
                  section="screen"
                  name="testPattern"
                  label="Show test pattern on the TV"
                />
                <div className="field-grid">{fields('screen')}</div>
              </Section>
            </>
          )}

          {tab === 'logo' && (
            <>
              <Section
                title="Home screen"
                description="Bouncing fills the screen with the moving logo. Corner keeps the Aspect logo in one corner over an animated neon grid, and shows today's top 10 every 20 seconds."
              >
                <div className="field-grid">
                  <ChoiceSetting
                    section="display"
                    name="mode"
                    label="Style"
                    choices={[
                      { value: 'bounce', label: 'Bouncing logo' },
                      { value: 'corner', label: 'Corner logo + neon' },
                    ]}
                  />
                  {settings.display.mode === 'corner' && (
                    <ChoiceSetting
                      section="display"
                      name="corner"
                      label="Logo corner"
                      choices={[
                        { value: 'top-left', label: 'Top left' },
                        { value: 'top-right', label: 'Top right' },
                        { value: 'bottom-left', label: 'Bottom left' },
                        { value: 'bottom-right', label: 'Bottom right' },
                      ]}
                    />
                  )}
                </div>
              </Section>
              <Section
                title={settings.display.mode === 'bounce' ? 'Bouncing logo' : 'Screen effect'}
                description={
                  settings.display.mode === 'bounce'
                    ? 'Size and margins follow the shorter edge of the TV window.'
                    : 'Logo size, speed, glow, and margin only apply to the bouncing style.'
                }
                onReset={(): void => resetSettings('display')}
              >
                <ToggleSetting
                  section="display"
                  name="paused"
                  label="Pause the logo and scan sweep"
                />
                <div className="field-grid">{fields('display')}</div>
              </Section>
            </>
          )}

          {tab === 'window' && (
            <>
              <WindowPanel />
              <Section title="Keypad hand-back">
                <div className="field-grid">{fields('admin')}</div>
              </Section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
