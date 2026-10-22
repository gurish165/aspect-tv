// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings, sanitize } from '../lib/booth'
import { getSettings, updateSettings } from '../lib/boothStore'
import { DEFAULT_KEYS, keyLabel } from '../lib/keys'
import { ArcadeInput, actionKey, isArcadeKey, keypadLabels, type Action } from './input'

const input = new ArcadeInput()

function press(code: string): readonly Action[] {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }))
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }))
  return input.consume().presses
}

describe('keypad mapping', (): void => {
  input.attach(window)
  beforeEach((): void => {
    window.localStorage.clear()
    updateSettings(defaultSettings())
  })
  afterEach((): void => {
    input.consume()
  })

  it('jumps with 0 only, and ducks with "."', (): void => {
    expect(press('Numpad0')).toContain('jump')
    expect(press('Numpad5')).not.toContain('jump')
    expect(press('NumpadEnter')).not.toContain('jump')
    expect(press('NumpadDecimal')).toEqual(['duck'])
    expect(press('Numpad2')).not.toContain('duck')
  })

  it('opens the leaderboard with Tab', (): void => {
    expect(press('Tab')).toEqual(['leaderboard'])
  })

  it('works the same with NumLock off', (): void => {
    expect(press('Insert')).toContain('jump')
    expect(press('Delete')).toContain('duck')
  })

  it('swallows unbound keypad keys and ignores everything else', (): void => {
    expect(isArcadeKey('Numpad7')).toBe(true)
    expect(press('Numpad7')).toEqual([])
    expect(isArcadeKey('KeyQ')).toBe(false)
  })

  it('follows key changes from the admin window right away', (): void => {
    updateSettings({ keys: { jump: ['Numpad7'], confirm: ['NumpadEnter'] } })
    expect(press('Numpad7')).toEqual(['jump'])
    expect(press('Numpad0')).toEqual([])
    updateSettings({ keys: { leaderboard: ['KeyT'] } })
    expect(press('KeyT')).toEqual(['leaderboard'])
    expect(isArcadeKey('KeyT')).toBe(true)
  })

  it('draws the first bound key on keycaps', (): void => {
    expect(actionKey('confirm')).toBe('ENTER')
    expect(actionKey('jump')).toBe('0')
    expect(actionKey('duck')).toBe('.')
    expect(actionKey('back')).toBe('BACK')
    expect(actionKey('leaderboard')).toBe('TAB')
    updateSettings({ keys: { up: ['ArrowUp', 'Numpad8'] } })
    expect(actionKey('up')).toBe('UP')
    expect(keypadLabels('up')).toEqual(['8'])
  })

  it('steers with the inverted T: 5 up, 1 left, 2 down, 3 right', (): void => {
    expect(press('Numpad5')).toEqual(['up'])
    expect(press('Numpad1')).toEqual(['left'])
    expect(press('Numpad2')).toEqual(['down'])
    expect(press('Numpad3')).toEqual(['right'])
    expect(press('Numpad8')).toEqual([])
    expect(actionKey('up')).toBe('5')
    expect(actionKey('left')).toBe('1')
  })
})

describe('key bindings', (): void => {
  it('labels keys the way the TV draws them', (): void => {
    expect(keyLabel('Numpad7')).toBe('7')
    expect(keyLabel('NumpadAdd')).toBe('+')
    expect(keyLabel('KeyW')).toBe('W')
    expect(keyLabel('Digit3')).toBe('3')
    expect(keyLabel('Space')).toBe('SPACE')
  })

  it('moves saved old default directions to the inverted T', (): void => {
    const keys = sanitize({
      keys: { up: ['Numpad8', 'ArrowUp'], left: ['Numpad4', 'ArrowLeft'], down: ['Numpad8'] },
    }).keys
    expect(keys.up).toEqual(DEFAULT_KEYS.up)
    expect(keys.left).toEqual(DEFAULT_KEYS.left)
    // A custom binding is kept, even if it uses an old key.
    expect(keys.down).toEqual(['Numpad8'])
  })

  it('keeps valid keys, drops junk, and never leaves an action without a key', (): void => {
    const keys = sanitize({
      keys: { up: ['Numpad9', 'Numpad9', '<script>', 7], down: [], back: 'Backspace' },
    }).keys
    expect(keys.up).toEqual(['Numpad9'])
    expect(keys.down).toEqual(DEFAULT_KEYS.down)
    expect(keys.back).toEqual(DEFAULT_KEYS.back)
    expect(getSettings().keys.confirm.length).toBeGreaterThan(0)
  })
})
