import type { DisplaySettings } from './settings'

export const BOUNCE_COLORS: readonly string[] = [
  '#798cf2',
  '#ef4444',
  '#22c55e',
  '#eab308',
  '#3f57d7',
  '#ec4899',
  '#06b6d4',
]

export const LOGO_ASPECT_RATIO: number = 186 / 155

class BounceAxis {
  position: number = 0
  #limit: number = 0
  #direction: number = 1
  #initialProgress: number

  constructor(initialProgress: number) {
    this.#initialProgress = initialProgress
  }

  resize(limit: number): void {
    const progress: number = this.#limit > 0 ? this.position / this.#limit : this.#initialProgress
    this.#limit = Math.max(0, limit)
    this.position = progress * this.#limit
  }

  advance(distance: number): boolean {
    if (this.#limit <= 0 || distance <= 0) return false
    const period: number = this.#limit * 2
    const previous: number = this.#direction > 0 ? this.position : period - this.position
    const nextPosition: number = previous + distance
    const wrapped: number = nextPosition % period
    const collided: boolean =
      Math.floor(nextPosition / this.#limit) > Math.floor(previous / this.#limit)

    // Reflect excess travel instead of discarding it at the screen edge.
    this.position = wrapped <= this.#limit ? wrapped : period - wrapped
    this.#direction = wrapped < this.#limit ? 1 : -1
    return collided
  }
}

export class BounceSimulation {
  width: number = 0
  height: number = 0
  #horizontal: BounceAxis = new BounceAxis(0.15)
  #vertical: BounceAxis = new BounceAxis(0.2)
  #inset: number = 0
  #shorterEdge: number = 0
  #colorIndex: number = 0

  get left(): number {
    return this.#inset + this.#horizontal.position
  }

  get top(): number {
    return this.#inset + this.#vertical.position
  }

  get color(): string {
    return BOUNCE_COLORS[this.#colorIndex] ?? '#798cf2'
  }

  resize(width: number, height: number, settings: DisplaySettings): void {
    this.#shorterEdge = Math.max(0, Math.min(width, height))
    this.#inset = (this.#shorterEdge * settings.padding) / 100
    this.width = (this.#shorterEdge * settings.logoSize) / 100
    this.height = this.width / LOGO_ASPECT_RATIO
    this.#horizontal.resize(width - this.width - this.#inset * 2)
    this.#vertical.resize(height - this.height - this.#inset * 2)
  }

  advance(deltaMilliseconds: number, speed: number): void {
    const seconds: number = Math.max(0, Math.min(deltaMilliseconds, 100)) / 1000
    const distance: number = this.#shorterEdge * 0.1 * speed * seconds
    const horizontalCollision: boolean = this.#horizontal.advance(distance * 0.8)
    const verticalCollision: boolean = this.#vertical.advance(distance * 0.6)
    if (horizontalCollision || verticalCollision) {
      this.#colorIndex = (this.#colorIndex + 1) % BOUNCE_COLORS.length
    }
  }
}
