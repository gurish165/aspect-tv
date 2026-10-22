import type { ReactElement } from 'react'
import { JETPACK_FEEL, NUMBER_FIELDS, type BoothSettings, type NumberField } from '../lib/booth'
import { updateSettings, useBoothSettings } from '../lib/boothStore'
import { feelFrom, simulateFeel } from '../lib/flight'
import { ChoiceSetting, NumberSetting } from './fields'
import { FlightSandbox } from './FlightSandbox'

/** The jetpack's feel settings, in the order they appear. */
const THRUST_KEYS: readonly string[] = ['thrust', 'maxRise', 'thrustRamp']
const GRAVITY_KEYS: readonly string[] = ['gravity', 'maxFall', 'fallRamp']

const CURVE_CHOICES = [
  { value: 'linear', label: 'Linear' },
  { value: 'quadratic', label: 'Quadratic' },
  { value: 'exponential', label: 'Exponential' },
] as const

function feelFields(keys: readonly string[]): ReactElement[] {
  return keys.map((key: string): ReactElement => {
    const field: NumberField | undefined = NUMBER_FIELDS.find(
      (candidate: NumberField): boolean => candidate.section === 'jetpack' && candidate.key === key,
    )
    if (!field) throw new Error(`No setting for jetpack.${key}`)
    return <NumberSetting key={key} field={field} />
  })
}

// The preview: one second of holding the button, then letting go, plotted as height over time.
const HOLD_TICKS: number = 60
const TOTAL_TICKS: number = 180
const CHART_WIDTH: number = 520
const CHART_HEIGHT: number = 150
const PADDING: number = 24

function FeelChart({ settings }: { settings: BoothSettings }): ReactElement {
  const heights: number[] = simulateFeel(feelFrom(settings.jetpack), HOLD_TICKS, TOTAL_TICKS)
  const highest: number = Math.max(20, ...heights)
  const lowest: number = Math.min(0, ...heights)
  const x = (tick: number): number => PADDING + (tick / TOTAL_TICKS) * (CHART_WIDTH - PADDING * 2)
  const y = (height: number): number =>
    CHART_HEIGHT - PADDING - ((height - lowest) / (highest - lowest)) * (CHART_HEIGHT - PADDING * 2)
  const points: string = heights
    .map((height: number, tick: number): string => `${x(tick).toFixed(1)},${y(height).toFixed(1)}`)
    .join(' ')
  const peak: number = heights.indexOf(Math.max(...heights))
  return (
    <figure className="feel-chart">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`Height over three seconds: holding 0 for one second climbs ${Math.round(
          Math.max(...heights),
        )} pixels, then the editor falls back down.`}
      >
        <rect
          x={x(0)}
          y={PADDING / 2}
          width={x(HOLD_TICKS) - x(0)}
          height={CHART_HEIGHT - PADDING * 1.5}
          className="feel-hold"
        />
        <line x1={x(0)} x2={x(TOTAL_TICKS)} y1={y(0)} y2={y(0)} className="feel-axis" />
        <polyline points={points} className="feel-line" />
        <circle cx={x(peak)} cy={y(heights[peak] ?? 0)} r={4} className="feel-peak" />
        <text x={x(HOLD_TICKS / 2)} y={PADDING / 2 + 14} textAnchor="middle" className="feel-label">
          holding 0
        </text>
        <text
          x={x((HOLD_TICKS + TOTAL_TICKS) / 2)}
          y={PADDING / 2 + 14}
          textAnchor="middle"
          className="feel-label"
        >
          let go
        </text>
        <text x={x(peak)} y={y(heights[peak] ?? 0) - 9} textAnchor="middle" className="feel-label">
          {Math.round(heights[peak] ?? 0)} px
        </text>
        {[0, 1, 2, 3].map((second: number): ReactElement => (
          <text
            key={second}
            x={x(second * 60)}
            y={CHART_HEIGHT - 6}
            textAnchor="middle"
            className="feel-label"
          >
            {second}s
          </text>
        ))}
      </svg>
      <figcaption className="field-help">
        Height of the editor when 0 is held for one second from the floor, then let go. From floor
        to ceiling is about 130 pixels.
      </figcaption>
    </figure>
  )
}

/** Jetpack feel: thrust and gravity, how fast each builds, along which curve, with a live preview. */
export function JetpackFeel(): ReactElement {
  const settings: BoothSettings = useBoothSettings()
  return (
    <>
      <FlightSandbox />
      <FeelChart settings={settings} />
      <h3 className="feel-heading">Thrust, while 0 is held</h3>
      <div className="field-grid">
        {feelFields(THRUST_KEYS)}
        <ChoiceSetting
          section="jetpack"
          name="thrustCurve"
          label="Thrust curve"
          choices={CURVE_CHOICES}
        />
      </div>
      <h3 className="feel-heading">Gravity, after letting go</h3>
      <div className="field-grid">
        {feelFields(GRAVITY_KEYS)}
        <ChoiceSetting
          section="jetpack"
          name="fallCurve"
          label="Gravity curve"
          choices={CURVE_CHOICES}
        />
      </div>
      <p className="field-help">
        Linear builds steadily. Quadratic starts slow and catches up. Exponential holds back the
        longest, then arrives all at once. A ramp of Instant ignores the curve.
      </p>
      <div className="button-row">
        <button
          type="button"
          className="secondary-button"
          onClick={(): void => updateSettings({ jetpack: JETPACK_FEEL })}
        >
          Reset feel
        </button>
      </div>
    </>
  )
}

export const FEEL_KEYS: readonly string[] = [...THRUST_KEYS, ...GRAVITY_KEYS]
