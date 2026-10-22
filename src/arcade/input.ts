// The booth keypad is the only input attendees use. Which keys drive which action is set in the
// admin window (see lib/keys); keys are matched by physical code, so the mapping holds with
// NumLock on or off.

import type { BoothSettings } from '../lib/booth'
import { getSettings } from '../lib/boothStore'
import { type Action, type KeyBindings, type KeyMap, keyLabel, keyMap } from '../lib/keys'

export type { Action } from '../lib/keys'

let cachedBindings: KeyBindings | undefined
let cachedMap: KeyMap = new Map()

/** The current key map, rebuilt only when the bindings change. */
function currentMap(): KeyMap {
  const bindings: KeyBindings = getSettings().keys
  if (bindings !== cachedBindings) {
    cachedBindings = bindings
    cachedMap = keyMap(bindings)
  }
  return cachedMap
}

export function isArcadeKey(code: string): boolean {
  return currentMap().has(code)
}

/** The label drawn on the TV for an action's keycap: its first bound key. */
export function actionKey(action: Action, settings: BoothSettings = getSettings()): string {
  const code: string | undefined = settings.keys[action][0]
  return code ? keyLabel(code) : '?'
}

/** Every keypad digit or "." bound to an action, for lighting up the on-screen keypad. */
export function keypadLabels(action: Action, settings: BoothSettings = getSettings()): string[] {
  return settings.keys[action]
    .filter((code: string): boolean => /^Numpad(\d|Decimal)$/.test(code))
    .map(keyLabel)
}

export interface InputFrame {
  /** Actions pressed since the previous tick, in order. */
  presses: readonly Action[]
  /** Actions whose keys are held down right now. */
  held: ReadonlySet<Action>
  pressed(action: Action): boolean
}

export class ArcadeInput {
  #presses: Action[] = []
  #heldCodes: Set<string> = new Set()
  #target: Window | undefined

  #keydown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const actions: readonly Action[] | undefined = currentMap().get(event.code)
    if (!actions) return
    // Keep these keys away from the page: no focus moves, no button clicks, no admin shortcuts.
    event.preventDefault()
    event.stopPropagation()
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    this.#heldCodes.add(event.code)
    if (event.repeat) return
    this.#presses.push(...actions)
  }

  #keyup = (event: KeyboardEvent): void => {
    if (!currentMap().has(event.code)) return
    event.preventDefault()
    event.stopPropagation()
    this.#heldCodes.delete(event.code)
  }

  #release = (): void => {
    this.#heldCodes.clear()
  }

  attach(target: Window): void {
    this.#target = target
    target.addEventListener('keydown', this.#keydown, { capture: true })
    target.addEventListener('keyup', this.#keyup, { capture: true })
    target.addEventListener('blur', this.#release)
  }

  detach(): void {
    this.#target?.removeEventListener('keydown', this.#keydown, { capture: true })
    this.#target?.removeEventListener('keyup', this.#keyup, { capture: true })
    this.#target?.removeEventListener('blur', this.#release)
    this.#target = undefined
  }

  /** Returns everything pressed since the last call, plus what is held. */
  consume(): InputFrame {
    const presses: Action[] = this.#presses
    this.#presses = []
    const held: Set<Action> = new Set()
    for (const code of this.#heldCodes) {
      for (const action of currentMap().get(code) ?? []) held.add(action)
    }
    return {
      presses,
      held,
      pressed: (action: Action): boolean => presses.includes(action),
    }
  }
}
