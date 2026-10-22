// Which physical keys drive each arcade action. Staff can change these from the admin window; the
// TV reads them live, and every keycap drawn on screen shows the first key bound to its action.
// Keys are matched by physical code, so a binding holds with NumLock on or off.

export type Action =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'confirm'
  | 'jump'
  | 'duck'
  | 'back'
  | 'leaderboard'
  | 'volumeUp'
  | 'volumeDown'

export type KeyBindings = Record<Action, string[]>

/** Where an action is used, for grouping the admin window's key list. */
export type ActionGroup = 'general' | 'directions' | 'runner'

export interface ActionInfo {
  action: Action
  group: ActionGroup
  label: string
  help: string
}

/** Every bindable action, grouped and in the order the admin window lists them. */
export const ACTIONS: readonly ActionInfo[] = [
  {
    action: 'confirm',
    group: 'general',
    label: 'Enter / start',
    help: 'Starts, picks, resumes, and saves. The first key is the one shown as ENTER on the TV.',
  },
  {
    action: 'back',
    group: 'general',
    label: 'Back / pause',
    help: 'Pauses a game, goes back, and ends a paused game.',
  },
  {
    action: 'leaderboard',
    group: 'general',
    label: 'Top 10',
    help: "Opens today's top 10 from the home screen.",
  },
  {
    action: 'volumeUp',
    group: 'general',
    label: 'Volume up',
    help: 'Only while keypad volume is turned on.',
  },
  {
    action: 'volumeDown',
    group: 'general',
    label: 'Volume down',
    help: 'Only while keypad volume is turned on.',
  },
  { action: 'up', group: 'directions', label: 'Up', help: 'Steers up, and picks the next letter.' },
  {
    action: 'down',
    group: 'directions',
    label: 'Down',
    help: 'Steers down, and picks the previous letter.',
  },
  {
    action: 'left',
    group: 'directions',
    label: 'Left',
    help: 'Steers left, chooses a game, and moves between initials.',
  },
  {
    action: 'right',
    group: 'directions',
    label: 'Right',
    help: 'Steers right, chooses a game, and moves between initials.',
  },
  { action: 'jump', group: 'runner', label: 'Jump', help: 'Jumps over cables and gear.' },
  { action: 'duck', group: 'runner', label: 'Duck', help: 'Ducks under boom mics.' },
]

/** At most this many keys per action. */
export const MAX_KEYS: number = 6

// The keypad key comes first so it is the one drawn on the TV; laptop keys follow for testing.
export const DEFAULT_KEYS: KeyBindings = {
  // Directions are the keypad's inverted T: 5 up, 1 left, 2 down, 3 right.
  up: ['Numpad5', 'ArrowUp'],
  down: ['Numpad2', 'ArrowDown'],
  left: ['Numpad1', 'ArrowLeft'],
  right: ['Numpad3', 'ArrowRight'],
  confirm: ['NumpadEnter', 'Enter', 'Numpad0', 'Insert'],
  jump: ['Numpad0', 'Insert', 'ArrowUp'],
  duck: ['NumpadDecimal', 'Delete', 'ArrowDown'],
  back: ['Backspace'],
  leaderboard: ['Tab'],
  volumeUp: ['NumpadAdd'],
  volumeDown: ['NumpadSubtract'],
}

/**
 * Keypad keys that do nothing unless bound. They are still swallowed, so a stray press never
 * moves focus, scrolls, or triggers a page shortcut.
 */
const RESERVED: readonly string[] = [
  'Numpad0',
  'Numpad1',
  'Numpad2',
  'Numpad3',
  'Numpad4',
  'Numpad5',
  'Numpad6',
  'Numpad7',
  'Numpad8',
  'Numpad9',
  'NumpadDecimal',
  'NumpadEnter',
  'NumpadAdd',
  'NumpadSubtract',
  'NumpadDivide',
  'NumpadMultiply',
  'NumpadEqual',
  'NumLock',
  'Insert',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Clear',
  'Tab',
  'Backspace',
]

/** Earlier default bindings; saved settings still holding one move to the current default. */
const RETIRED_KEYS: Partial<Record<Action, readonly (readonly string[])[]>> = {
  up: [['Numpad8', 'ArrowUp']],
  left: [['Numpad4', 'ArrowLeft']],
  right: [['Numpad6', 'ArrowRight']],
  confirm: [['NumpadEnter', 'Enter', 'Numpad5', 'Numpad0', 'Insert']],
}

const CODE_PATTERN: RegExp = /^[A-Za-z0-9]{1,32}$/

export function defaultKeys(): KeyBindings {
  return Object.fromEntries(
    ACTIONS.map(({ action }): [Action, string[]] => [action, [...DEFAULT_KEYS[action]]]),
  ) as KeyBindings
}

/** Keeps valid, distinct key codes for each action; an action left with none gets its defaults. */
export function sanitizeKeys(value: unknown): KeyBindings {
  const source: Record<string, unknown> =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const result: KeyBindings = defaultKeys()
  for (const { action } of ACTIONS) {
    const raw: unknown = source[action]
    if (!Array.isArray(raw)) continue
    const codes: string[] = [
      ...new Set(
        raw.filter(
          (code: unknown): code is string => typeof code === 'string' && CODE_PATTERN.test(code),
        ),
      ),
    ].slice(0, MAX_KEYS)
    const retired: boolean = (RETIRED_KEYS[action] ?? []).some(
      (old: readonly string[]): boolean =>
        old.length === codes.length &&
        old.every((code: string, index: number) => code === codes[index]),
    )
    if (codes.length > 0 && !retired) result[action] = codes
  }
  return result
}

export type KeyMap = ReadonlyMap<string, readonly Action[]>

/** Actions for each key code, in the order the actions are listed. */
export function keyMap(bindings: KeyBindings): KeyMap {
  const map: Map<string, Action[]> = new Map(
    RESERVED.map((code: string): [string, Action[]] => [code, []]),
  )
  for (const { action } of ACTIONS) {
    for (const code of bindings[action]) {
      const actions: Action[] = map.get(code) ?? []
      if (!actions.includes(action)) actions.push(action)
      map.set(code, actions)
    }
  }
  return map
}

const NAMED: Record<string, string> = {
  NumpadDecimal: '.',
  NumpadEnter: 'ENTER',
  Enter: 'ENTER',
  NumpadAdd: '+',
  NumpadSubtract: '-',
  NumpadMultiply: '*',
  NumpadDivide: '/',
  NumpadEqual: '=',
  Backspace: 'BACK',
  Tab: 'TAB',
  Space: 'SPACE',
  Escape: 'ESC',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  Insert: 'INS',
  Delete: 'DEL',
  Home: 'HOME',
  End: 'END',
  PageUp: 'PGUP',
  PageDown: 'PGDN',
  NumLock: 'NUM',
  Minus: '-',
  Equal: '=',
  Period: '.',
  Comma: ',',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  ShiftLeft: 'SHIFT',
  ShiftRight: 'SHIFT',
}

/** A short label for a key code, as drawn on a keycap on the TV. */
export function keyLabel(code: string): string {
  const named: string | undefined = NAMED[code]
  if (named) return named
  const keypadDigit: RegExpMatchArray | null = /^Numpad(\d)$/.exec(code)
  if (keypadDigit) return keypadDigit[1]!
  const letterOrDigit: RegExpMatchArray | null = /^(?:Key|Digit)(\w)$/.exec(code)
  if (letterOrDigit) return letterOrDigit[1]!
  if (/^F\d{1,2}$/.test(code)) return code
  return code.toUpperCase().slice(0, 5)
}

/** A friendlier name for a key code in the admin window, e.g. "Keypad 8". */
export function keyName(code: string): string {
  const keypadDigit: RegExpMatchArray | null = /^Numpad(\d)$/.exec(code)
  if (keypadDigit) return `Keypad ${keypadDigit[1]}`
  const keypad: Record<string, string> = {
    NumpadDecimal: 'Keypad .',
    NumpadEnter: 'Keypad Enter',
    NumpadAdd: 'Keypad +',
    NumpadSubtract: 'Keypad −',
    NumpadMultiply: 'Keypad ×',
    NumpadDivide: 'Keypad ÷',
    NumpadEqual: 'Keypad =',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Insert: 'Insert (NumLock off 0)',
    Delete: 'Delete (NumLock off .)',
  }
  if (keypad[code]) return keypad[code]
  const letterOrDigit: RegExpMatchArray | null = /^(?:Key|Digit)(\w)$/.exec(code)
  if (letterOrDigit) return letterOrDigit[1]!
  return code
}
