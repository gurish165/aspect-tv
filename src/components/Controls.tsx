import type { ChangeEvent, ReactElement } from 'react'
import { DISPLAY_CONTROLS, DisplaySettings, type SettingName } from '../lib/settings'

const DEFAULT_SETTINGS: DisplaySettings = new DisplaySettings()

interface ControlsProps {
  settings: DisplaySettings
  settingsOpen: boolean
  visible: boolean
  paused: boolean
  fullscreen: boolean
  windowLocked: boolean | null
  notice: string
  onSettingChange: (property: SettingName, value: number) => void
  onSettingsToggle: () => void
  onPauseToggle: () => void
  onFullscreenToggle: () => void
  onWindowLockToggle: () => void
  onReset: () => void
}

export function Controls({
  settings,
  settingsOpen,
  visible,
  paused,
  fullscreen,
  windowLocked,
  notice,
  onSettingChange,
  onSettingsToggle,
  onPauseToggle,
  onFullscreenToggle,
  onWindowLockToggle,
  onReset,
}: ControlsProps): ReactElement {
  return (
    <div className="controls" data-controls="true" hidden={!visible}>
      {settingsOpen && (
        <section className="settings-panel" aria-labelledby="settings-title">
          <header className="settings-header">
            <div>
              <p className="eyebrow">Make yourself at home</p>
              <h1 id="settings-title">Display settings</h1>
            </div>
            <button
              type="button"
              className="quiet-button"
              onClick={onSettingsToggle}
              aria-label="Close settings"
            >
              Close
            </button>
          </header>
          <div className="sliders">
            {DISPLAY_CONTROLS.map((control): ReactElement => {
              const inputId: string = `setting-${control.property}`
              const defaultValue: number = DEFAULT_SETTINGS[control.property]
              const revert = (): void => {
                onSettingChange(control.property, defaultValue)
                // The button hides once the value is back to default, so keep focus nearby.
                document.getElementById(inputId)?.focus({ preventScroll: true })
              }
              return (
                <div className="slider-control" key={control.property}>
                  <span className="slider-label">
                    <label htmlFor={inputId}>{control.label}</label>
                    <span className="slider-value">
                      <button
                        type="button"
                        className="revert-button"
                        hidden={settings[control.property] === defaultValue}
                        onClick={revert}
                        aria-label={`Revert ${control.label.toLowerCase()} to default, ${control.format(defaultValue)}`}
                        title={`Revert to default (${control.format(defaultValue)})`}
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M3.5 6.5A5 5 0 1 1 3 9.5" />
                          <path d="M3 3v3.5h3.5" />
                        </svg>
                      </button>
                      <output htmlFor={inputId}>
                        {control.format(settings[control.property])}
                      </output>
                    </span>
                  </span>
                  <input
                    id={inputId}
                    type="range"
                    min={control.minimum}
                    max={control.maximum}
                    step={control.step}
                    value={settings[control.property]}
                    onChange={(event: ChangeEvent<HTMLInputElement>): void =>
                      onSettingChange(control.property, event.currentTarget.valueAsNumber)
                    }
                  />
                </div>
              )
            })}
          </div>
          <footer className="settings-footer">
            <p>
              Size and margins follow the shorter edge of your window.{' '}
              {window.aspectDesktop?.remembersSettings
                ? 'Your settings are saved for next time.'
                : 'Bookmark this URL to keep your settings.'}
            </p>
            <button type="button" className="quiet-button" onClick={onReset}>
              Reset
            </button>
          </footer>
        </section>
      )}
      <div className="control-bar">
        <div className="identity">
          <span className="status-dot" data-paused={paused} />
          <span>Aspect TV</span>
        </div>
        <div className="control-actions">
          <button
            type="button"
            onClick={onPauseToggle}
            aria-label={paused ? 'Play animation' : 'Pause animation'}
          >
            {paused ? 'Play' : 'Pause'}
            <kbd>Space</kbd>
          </button>
          <button type="button" onClick={onSettingsToggle} aria-expanded={settingsOpen}>
            Settings<kbd>S</kbd>
          </button>
          {windowLocked !== null && (
            <button
              type="button"
              onClick={onWindowLockToggle}
              aria-pressed={windowLocked}
              title={
                windowLocked
                  ? 'The window stays in this spot and size. Click to move it again.'
                  : 'Pin the window to this spot and size, including next launch.'
              }
            >
              {windowLocked ? 'Unlock' : 'Lock'}
              <kbd>L</kbd>
            </button>
          )}
          <button type="button" onClick={onFullscreenToggle}>
            {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            <kbd>F</kbd>
          </button>
        </div>
      </div>
      <p className="control-hint">
        Move the pointer or tap to reveal controls
        {windowLocked === false && ' · Drag the background to move the window'} · Double-click for
        fullscreen
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </div>
  )
}
