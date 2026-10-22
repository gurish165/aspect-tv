// Chiptune sound effects synthesized on the fly, so there are no audio files to ship.

export type SoundName =
  | 'move'
  | 'select'
  | 'start'
  | 'back'
  | 'count'
  | 'go'
  | 'eat'
  | 'bonus'
  | 'jump'
  | 'coin'
  | 'milestone'
  | 'crash'
  | 'gameOver'
  | 'highScore'
  | 'reward'
  | 'pause'
  | 'letter'
  | 'shoot'
  | 'explode'
  | 'dive'

interface Tone {
  frequency: number
  slideTo?: number
  duration: number
  delay?: number
  type?: OscillatorType
  volume?: number
}

const NOTES: Record<SoundName, readonly Tone[]> = {
  move: [{ frequency: 660, duration: 0.04, volume: 0.12 }],
  select: [
    { frequency: 880, duration: 0.06 },
    { frequency: 1320, duration: 0.08, delay: 0.06 },
  ],
  start: [
    { frequency: 523, duration: 0.08 },
    { frequency: 659, duration: 0.08, delay: 0.08 },
    { frequency: 784, duration: 0.08, delay: 0.16 },
    { frequency: 1047, duration: 0.16, delay: 0.24 },
  ],
  back: [{ frequency: 440, slideTo: 220, duration: 0.12, volume: 0.14 }],
  count: [{ frequency: 440, duration: 0.1 }],
  go: [{ frequency: 880, duration: 0.25 }],
  eat: [{ frequency: 520, slideTo: 1040, duration: 0.07, volume: 0.16 }],
  bonus: [
    { frequency: 784, duration: 0.06 },
    { frequency: 1047, duration: 0.06, delay: 0.06 },
    { frequency: 1568, duration: 0.12, delay: 0.12 },
  ],
  jump: [{ frequency: 300, slideTo: 620, duration: 0.1, volume: 0.12 }],
  coin: [
    { frequency: 988, duration: 0.05 },
    { frequency: 1319, duration: 0.12, delay: 0.05 },
  ],
  milestone: [
    { frequency: 1047, duration: 0.05, volume: 0.1 },
    { frequency: 1319, duration: 0.07, delay: 0.06, volume: 0.1 },
  ],
  crash: [
    { frequency: 220, slideTo: 40, duration: 0.35, type: 'sawtooth', volume: 0.22 },
    { frequency: 110, slideTo: 30, duration: 0.4, type: 'square', volume: 0.12 },
  ],
  gameOver: [
    { frequency: 392, duration: 0.18 },
    { frequency: 330, duration: 0.18, delay: 0.2 },
    { frequency: 262, duration: 0.36, delay: 0.4 },
  ],
  highScore: [
    { frequency: 523, duration: 0.1 },
    { frequency: 659, duration: 0.1, delay: 0.1 },
    { frequency: 784, duration: 0.1, delay: 0.2 },
    { frequency: 1047, duration: 0.1, delay: 0.3 },
    { frequency: 784, duration: 0.1, delay: 0.4 },
    { frequency: 1047, duration: 0.3, delay: 0.5 },
  ],
  reward: [
    { frequency: 659, duration: 0.12 },
    { frequency: 784, duration: 0.12, delay: 0.12 },
    { frequency: 988, duration: 0.12, delay: 0.24 },
    { frequency: 1319, duration: 0.4, delay: 0.36, type: 'triangle', volume: 0.24 },
  ],
  pause: [{ frequency: 600, duration: 0.06, volume: 0.12 }],
  letter: [{ frequency: 780, duration: 0.035, volume: 0.1 }],
  // A short honk-like zap for each shot.
  shoot: [{ frequency: 1200, slideTo: 500, duration: 0.07, type: 'square', volume: 0.08 }],
  explode: [
    { frequency: 300, slideTo: 60, duration: 0.18, type: 'sawtooth', volume: 0.14 },
    { frequency: 160, slideTo: 40, duration: 0.16, type: 'square', volume: 0.08, delay: 0.02 },
  ],
  // The falling whistle of an enemy peeling off to dive.
  dive: [{ frequency: 1400, slideTo: 500, duration: 0.45, type: 'triangle', volume: 0.07 }],
}

export const MAX_VOLUME: number = 10

export class Sound {
  #context: AudioContext | undefined
  #master: GainNode | undefined
  #volume: number

  /** Volume comes from the booth settings, from 0 to MAX_VOLUME. */
  constructor(volume: number) {
    this.#volume = volume
  }

  get volume(): number {
    return this.#volume
  }

  set volume(volume: number) {
    this.#volume = Math.max(0, Math.min(MAX_VOLUME, volume))
    if (this.#master) this.#master.gain.value = this.#gain()
  }

  #gain(): number {
    return (this.#volume / MAX_VOLUME) ** 2 * 0.9
  }

  #ensure(): AudioContext | undefined {
    if (!this.#context) {
      try {
        this.#context = new AudioContext()
        this.#master = this.#context.createGain()
        this.#master.gain.value = this.#gain()
        this.#master.connect(this.#context.destination)
      } catch {
        return undefined
      }
    }
    if (this.#context.state === 'suspended') void this.#context.resume()
    return this.#context
  }

  play(name: SoundName): void {
    if (this.#volume === 0) return
    const context: AudioContext | undefined = this.#ensure()
    if (!context || !this.#master) return
    const now: number = context.currentTime
    for (const tone of NOTES[name]) {
      const start: number = now + (tone.delay ?? 0)
      const end: number = start + tone.duration
      const oscillator: OscillatorNode = context.createOscillator()
      const envelope: GainNode = context.createGain()
      oscillator.type = tone.type ?? 'square'
      oscillator.frequency.setValueAtTime(tone.frequency, start)
      if (tone.slideTo) oscillator.frequency.exponentialRampToValueAtTime(tone.slideTo, end)
      envelope.gain.setValueAtTime(tone.volume ?? 0.18, start)
      envelope.gain.exponentialRampToValueAtTime(0.0001, end)
      oscillator.connect(envelope)
      envelope.connect(this.#master)
      oscillator.start(start)
      oscillator.stop(end + 0.02)
    }
  }

  close(): void {
    void this.#context?.close()
    this.#context = undefined
    this.#master = undefined
  }
}
