import { useEffect, useId, useState, type ChangeEvent, type ReactElement } from 'react'
import {
  TEXT_LIMITS,
  arcadeText,
  defaultSettings,
  formatNumber,
  type BoothSettings,
  type NumberField,
  type SectionName,
} from '../lib/booth'
import { updateSettings, useBoothSettings } from '../lib/boothStore'

const DEFAULTS: BoothSettings = defaultSettings()

function read(settings: BoothSettings, section: SectionName, name: string): unknown {
  return (settings[section] as unknown as Record<string, unknown>)[name]
}

function RevertButton({
  label,
  defaultLabel,
  onRevert,
}: {
  label: string
  defaultLabel: string
  onRevert: () => void
}): ReactElement {
  return (
    <button
      type="button"
      className="revert-button"
      onClick={onRevert}
      aria-label={`Revert ${label.toLowerCase()} to default, ${defaultLabel}`}
      title={`Revert to default (${defaultLabel})`}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 6.5A5 5 0 1 1 3 9.5" />
        <path d="M3 3v3.5h3.5" />
      </svg>
    </button>
  )
}

export function NumberSetting({ field }: { field: NumberField }): ReactElement {
  const settings: BoothSettings = useBoothSettings()
  const id: string = useId()
  const value: number = read(settings, field.section, field.key) as number
  const defaultValue: number = read(DEFAULTS, field.section, field.key) as number
  const set = (next: number): void => {
    updateSettings({ [field.section]: { [field.key]: next } })
  }
  return (
    <div className="slider-control">
      <span className="slider-label">
        <label htmlFor={id}>{field.label}</label>
        <span className="slider-value">
          {value !== defaultValue && (
            <RevertButton
              label={field.label}
              defaultLabel={formatNumber(field, defaultValue)}
              onRevert={(): void => set(defaultValue)}
            />
          )}
          <output htmlFor={id}>{formatNumber(field, value)}</output>
        </span>
      </span>
      <input
        id={id}
        type="range"
        min={field.minimum}
        max={field.maximum}
        step={field.step}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>): void =>
          set(event.currentTarget.valueAsNumber)
        }
      />
      {field.help && <p className="field-help">{field.help}</p>}
    </div>
  )
}

export function TextSetting({
  section,
  name,
  label,
}: {
  section: SectionName
  name: string
  label: string
}): ReactElement {
  const settings: BoothSettings = useBoothSettings()
  const id: string = useId()
  const saved: string = read(settings, section, name) as string
  const defaultValue: string = read(DEFAULTS, section, name) as string
  const limit: number = TEXT_LIMITS[name] ?? 32
  // Keep a local draft so typing feels normal; the TV gets the cleaned-up text as you type.
  const [draft, setDraft] = useState<string>(saved)
  useEffect((): void => {
    setDraft((current: string): string =>
      arcadeText(current, saved, limit) === saved ? current : saved,
    )
  }, [saved, limit])

  const change = (event: ChangeEvent<HTMLInputElement>): void => {
    const next: string = event.currentTarget.value.toUpperCase()
    setDraft(next)
    updateSettings({ [section]: { [name]: next } })
  }
  return (
    <div className="text-control">
      <span className="slider-label">
        <label htmlFor={id}>{label}</label>
        <span className="slider-value">
          {saved !== defaultValue && (
            <RevertButton
              label={label}
              defaultLabel={defaultValue}
              onRevert={(): void => {
                setDraft(defaultValue)
                updateSettings({ [section]: { [name]: defaultValue } })
              }}
            />
          )}
          <output htmlFor={id}>
            {saved.length}/{limit}
          </output>
        </span>
      </span>
      <input
        id={id}
        type="text"
        value={draft}
        maxLength={limit}
        spellCheck={false}
        autoComplete="off"
        onChange={change}
        onBlur={(): void => setDraft(saved)}
      />
    </div>
  )
}

export function ToggleSetting({
  section,
  name,
  label,
}: {
  section: SectionName
  name: string
  label: string
}): ReactElement {
  const settings: BoothSettings = useBoothSettings()
  const id: string = useId()
  const checked: boolean = read(settings, section, name) === true
  return (
    <label className="toggle-control" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event: ChangeEvent<HTMLInputElement>): void =>
          updateSettings({ [section]: { [name]: event.currentTarget.checked } })
        }
      />
      <span>{label}</span>
    </label>
  )
}

export function ChoiceSetting<Value extends string>({
  section,
  name,
  label,
  choices,
}: {
  section: SectionName
  name: string
  label: string
  choices: readonly { value: Value; label: string }[]
}): ReactElement {
  const settings: BoothSettings = useBoothSettings()
  const current: unknown = read(settings, section, name)
  return (
    <div className="choice-control">
      <span className="slider-label">{label}</span>
      <div className="preset-picker" role="group" aria-label={label}>
        {choices.map((choice): ReactElement => (
          <button
            type="button"
            key={choice.value}
            aria-pressed={current === choice.value}
            onClick={(): void => updateSettings({ [section]: { [name]: choice.value } })}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  )
}
