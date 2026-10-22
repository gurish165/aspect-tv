import type { Sound } from './audio'
import type { Action, InputFrame } from './input'

export function inputFrame(
  presses: readonly Action[] = [],
  held: readonly Action[] = [],
): InputFrame {
  return {
    presses,
    held: new Set(held),
    pressed: (action: Action): boolean => presses.includes(action),
  }
}

export const silentSound = {
  volume: 6,
  play(): void {},
  close(): void {},
} as unknown as Sound

export interface Steppable {
  step?(input: InputFrame): void
  update?(input: InputFrame): void
}

/** Sends the presses on the first tick, then idles for the remaining ticks. */
export function run(target: Steppable, ticks: number, presses: readonly Action[] = []): void {
  for (let tick: number = 0; tick < ticks; tick += 1) {
    const input: InputFrame = inputFrame(tick === 0 ? presses : [])
    if (target.step) target.step(input)
    else target.update?.(input)
  }
}
