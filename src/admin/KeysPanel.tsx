import { useEffect, useState, type ReactElement } from 'react'
import type { BoothSettings } from '../lib/booth'
import { resetSettings, updateSettings, useBoothSettings } from '../lib/boothStore'
import {
  ACTIONS,
  DEFAULT_KEYS,
  MAX_KEYS,
  keyLabel,
  keyName,
  type Action,
  type ActionGroup,
  type ActionInfo,
} from '../lib/keys'

/** Keys staff can't bind: they belong to the admin window and the operating system. */
const UNBINDABLE: ReadonlySet<string> = new Set([
  'Escape',
  'MetaLeft',
  'MetaRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'CapsLock',
  'Fn',
])

function sameKeys(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((code, index) => code === second[index])
}

/**
 * Which keys drive each arcade action. "Add key" listens for the next key pressed in this window,
 * so staff press the actual keypad key while this window has the keypad.
 */
export function KeysPanel(): ReactElement {
  const settings: BoothSettings = useBoothSettings()
  const [listening, setListening] = useState<Action | null>(null)
  const [message, setMessage] = useState<string>('')

  useEffect((): (() => void) | undefined => {
    if (!listening) return
    const capture = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (event.repeat) return
      if (event.code === 'Escape' || !event.code) {
        setListening(null)
        setMessage('')
        return
      }
      if (UNBINDABLE.has(event.code) || event.metaKey || event.ctrlKey) {
        setMessage(`${keyName(event.code)} can't be used. Press another key, or Esc to cancel.`)
        return
      }
      const current: string[] = settings.keys[listening]
      if (current.includes(event.code)) {
        setMessage(`${keyName(event.code)} is already on this action.`)
      } else {
        // A new key goes last, so the key shown on the TV stays the same.
        updateSettings({ keys: { [listening]: [...current, event.code].slice(0, MAX_KEYS) } })
        setMessage('')
      }
      setListening(null)
    }
    window.addEventListener('keydown', capture, { capture: true })
    return (): void => window.removeEventListener('keydown', capture, { capture: true })
  }, [listening, settings.keys])

  const setKeys = (action: Action, codes: string[]): void => {
    updateSettings({ keys: { [action]: codes } })
  }

  /** Other actions sharing a key, so staff notice when one key does two things. */
  const sharedWith = (action: Action, code: string): string[] =>
    ACTIONS.filter(
      (other: ActionInfo): boolean =>
        other.action !== action && settings.keys[other.action].includes(code),
    ).map((other: ActionInfo): string => other.label)

  const renderRow = (info: ActionInfo): ReactElement => {
    const codes: string[] = settings.keys[info.action]
    const isDefault: boolean = sameKeys(codes, DEFAULT_KEYS[info.action])
    return (
      <div className="keys-row" key={info.action}>
        <div className="keys-action">
          <strong>{info.label}</strong>
          <span className="field-help">{info.help}</span>
        </div>
        <div className="keys-list">
          {codes.map((code: string, index: number): ReactElement => {
            const shared: string[] = sharedWith(info.action, code)
            return (
              <span
                className="key-chip"
                data-first={index === 0}
                key={code}
                title={shared.length > 0 ? `Also ${shared.join(', ')}` : undefined}
              >
                <kbd>{keyLabel(code)}</kbd>
                <span>{keyName(code)}</span>
                {shared.length > 0 && <span className="key-shared">+{shared.length}</span>}
                {index > 0 && (
                  <button
                    type="button"
                    aria-label={`Show ${keyName(code)} on the TV for ${info.label}`}
                    title="Make this the key shown on the TV"
                    onClick={(): void =>
                      setKeys(info.action, [code, ...codes.filter((other) => other !== code)])
                    }
                  >
                    ◀
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${keyName(code)} from ${info.label}`}
                  title={codes.length === 1 ? 'Every action needs at least one key' : 'Remove'}
                  disabled={codes.length === 1}
                  onClick={(): void =>
                    setKeys(
                      info.action,
                      codes.filter((other: string): boolean => other !== code),
                    )
                  }
                >
                  ×
                </button>
              </span>
            )
          })}
          <button
            type="button"
            className="claim-button"
            aria-pressed={listening === info.action}
            disabled={codes.length >= MAX_KEYS}
            onClick={(): void => {
              setMessage('')
              setListening(listening === info.action ? null : info.action)
            }}
          >
            {listening === info.action ? 'Press a key…' : 'Add key'}
          </button>
          {!isDefault && (
            <button
              type="button"
              className="quiet-button"
              onClick={(): void => setKeys(info.action, [...DEFAULT_KEYS[info.action]])}
            >
              Default
            </button>
          )}
        </div>
      </div>
    )
  }

  const groups: readonly { id: ActionGroup; title: string; description: string }[] = [
    {
      id: 'general',
      title: 'Everywhere',
      description: 'Menus, pausing, the top 10, and volume, on every screen.',
    },
    {
      id: 'directions',
      title: `Directions · ${settings.snake.title} and menus`,
      description: `Steer in ${settings.snake.title}, choose a game, and enter initials.`,
    },
    {
      id: 'runner',
      title: settings.runner.title,
      description: 'Used only while playing. Enter still starts the game.',
    },
  ]

  return (
    <section className="admin-card">
      <header>
        <div>
          <h2>Keys</h2>
          <p>
            Which keys drive each action. Click Add key, then press the key you want, here in this
            window. The first key on each row is the one drawn on the TV; use ◀ to make a key first.
            Changes reach the TV right away.
          </p>
        </div>
        <button type="button" className="quiet-button" onClick={(): void => resetSettings('keys')}>
          Reset all
        </button>
      </header>
      <p className="keys-status" role="status" aria-live="polite">
        {listening
          ? `Press a key for ${ACTIONS.find((info) => info.action === listening)?.label}… (Esc cancels)`
          : message}
      </p>
      {groups.map((group): ReactElement => (
        <div className="keys-group" key={group.id}>
          <h3>{group.title}</h3>
          <p className="field-help">{group.description}</p>
          <div className="keys-table">
            {ACTIONS.filter((info: ActionInfo): boolean => info.group === group.id).map(renderRow)}
          </div>
        </div>
      ))}
      <p className="admin-note">
        The keypad's other keys are kept away from the page, so a stray press never scrolls or
        clicks anything. A bound letter key wins over the TV window's S and A shortcuts.
      </p>
    </section>
  )
}
