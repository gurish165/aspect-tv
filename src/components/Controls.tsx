import type { ChangeEvent, ReactElement } from 'react'
import { DISPLAY_CONTROLS, DisplaySettings, type SettingName } from '../lib/settings'

interface ControlsProps {
  settings: DisplaySettings
  settingsOpen: boolean
  visible: boolean
  paused: boolean
  fullscreen: boolean
  notice: string
  onSettingChange: (property: SettingName, value: number) => void
  onSettingsToggle: () => void
  onPauseToggle: () => void
  onFullscreenToggle: () => void
  onReset: () => void
}

export function Controls({
  settings,
  settingsOpen,
  visible,
  paused,
  fullscreen,
  notice,
  onSettingChange,
  onSettingsToggle,
  onPauseToggle,
  onFullscreenToggle,
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
            {DISPLAY_CONTROLS.map((control): ReactElement => (
              <label className="slider-control" key={control.property}>
                <span className="slider-label">
                  <span>{control.label}</span>
                  <output>{control.format(settings[control.property])}</output>
                </span>
                <input
                  type="range"
                  min={control.minimum}
                  max={control.maximum}
                  step={control.step}
                  value={settings[control.property]}
                  onChange={(event: ChangeEvent<HTMLInputElement>): void =>
                    onSettingChange(control.property, event.currentTarget.valueAsNumber)
                  }
                />
              </label>
            ))}
          </div>
          <footer className="settings-footer">
            <p>
              Size and margins follow the shorter edge of your window. Bookmark this URL to keep
              your settings.
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
          <button type="button" onClick={onFullscreenToggle}>
            {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            <kbd>F</kbd>
          </button>
        </div>
      </div>
      <p className="control-hint">
        Move the pointer or tap to reveal controls · Double-click for fullscreen
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </div>
  )
}
