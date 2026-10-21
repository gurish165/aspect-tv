import { LOGO_ASPECT_RATIO } from './bounce'

const DEFAULT_LOGO_WIDTH: number = 28

function proportionalHeight(width: number): number {
  return Math.round((width / LOGO_ASPECT_RATIO) * 10) / 10
}

export class DisplaySettings {
  logoWidth: number = DEFAULT_LOGO_WIDTH
  logoHeight: number = proportionalHeight(DEFAULT_LOGO_WIDTH)
  speed: number = 1
  crt: number = 1
  scanSpacing: number = 4
  glow: number = 0.4
  padding: number = 1

  static fromSearch(search: string): DisplaySettings {
    const parameters: URLSearchParams = new URLSearchParams(search)
    const settings: DisplaySettings = new DisplaySettings()

    // Older URLs had one proportional size; keep their look by deriving both dimensions.
    const legacySize: number = Number(parameters.get('logoSize') ?? '')
    if (parameters.get('logoSize')?.trim() && Number.isFinite(legacySize)) {
      if (!parameters.has('logoWidth')) parameters.set('logoWidth', String(legacySize))
      if (!parameters.has('logoHeight')) {
        parameters.set('logoHeight', String(proportionalHeight(legacySize)))
      }
    }

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

export type SettingName =
  'logoWidth' | 'logoHeight' | 'speed' | 'crt' | 'scanSpacing' | 'glow' | 'padding'

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
  new DisplayControl('logoWidth', 'Logo width', 5, 90, 0.1, '%'),
  new DisplayControl('logoHeight', 'Logo height', 5, 90, 0.1, '%'),
  new DisplayControl('speed', 'Speed', 0.25, 3, 0.05, '×'),
  new DisplayControl('crt', 'CRT effect', 0, 2, 0.05, '×'),
  new DisplayControl('scanSpacing', 'Scanline spacing', 2, 10, 1, ' px'),
  new DisplayControl('glow', 'Logo glow', 0, 2, 0.05, '×'),
  new DisplayControl('padding', 'Edge margin', -12, 12, 0.5, '%'),
]
