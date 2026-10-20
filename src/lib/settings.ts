export class DisplaySettings {
  logoSize: number = 28
  speed: number = 1
  crt: number = 1
  scanSpacing: number = 4
  glow: number = 0.4
  padding: number = 1

  static fromSearch(search: string): DisplaySettings {
    const parameters: URLSearchParams = new URLSearchParams(search)
    const settings: DisplaySettings = new DisplaySettings()

    for (const control of DISPLAY_CONTROLS) {
      const rawValue: string | null = parameters.get(control.property)
      if (rawValue === null || rawValue.trim() === '') continue
      const value: number = Number(rawValue)
      if (!Number.isFinite(value)) continue
      settings[control.property] = Math.min(control.maximum, Math.max(control.minimum, value))
    }

    return settings
  }

  withValue(property: SettingName, value: number): DisplaySettings {
    return Object.assign(new DisplaySettings(), this, { [property]: value })
  }

  toSearch(): string {
    const parameters: URLSearchParams = new URLSearchParams()
    const defaults: DisplaySettings = new DisplaySettings()
    for (const control of DISPLAY_CONTROLS) {
      if (this[control.property] !== defaults[control.property]) {
        parameters.set(control.property, String(this[control.property]))
      }
    }
    return parameters.toString()
  }
}

export type SettingName = 'logoSize' | 'speed' | 'crt' | 'scanSpacing' | 'glow' | 'padding'

export class DisplayControl {
  property: SettingName
  label: string
  minimum: number
  maximum: number
  step: number
  unit: string

  constructor(
    property: SettingName,
    label: string,
    minimum: number,
    maximum: number,
    step: number,
    unit: string,
  ) {
    this.property = property
    this.label = label
    this.minimum = minimum
    this.maximum = maximum
    this.step = step
    this.unit = unit
  }

  format(value: number): string {
    return this.unit === '×' ? `${value.toFixed(2)}×` : `${value}${this.unit}`
  }
}

export const DISPLAY_CONTROLS: readonly DisplayControl[] = [
  new DisplayControl('logoSize', 'Logo size', 8, 70, 1, '%'),
  new DisplayControl('speed', 'Speed', 0.25, 3, 0.05, '×'),
  new DisplayControl('crt', 'CRT effect', 0, 2, 0.05, '×'),
  new DisplayControl('scanSpacing', 'Scanline spacing', 2, 10, 1, ' px'),
  new DisplayControl('glow', 'Logo glow', 0, 2, 0.05, '×'),
  new DisplayControl('padding', 'Edge margin', -12, 12, 0.5, '%'),
]
