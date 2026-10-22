import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react'
import type { GameId } from '../arcade/games/types'
import { REWARD_TIERS } from '../arcade/rewards'
import { defaultSettings, type BoothSettings } from '../lib/booth'
import { updateSettings } from '../lib/boothStore'

const DEFAULTS: BoothSettings = defaultSettings()
const GAMES: readonly GameId[] = ['snake', 'runner']

function ThresholdInput({
  game,
  index,
  value,
  settings,
}: {
  game: GameId
  index: number
  value: number
  settings: BoothSettings
}): ReactElement {
  // Edit freely, then save on blur or Enter, so typing "1500" doesn't pass through "1".
  const [draft, setDraft] = useState<string>(String(value))
  useEffect((): void => setDraft(String(value)), [value])
  const commit = (): void => {
    const number: number = Math.round(Number(draft))
    if (!Number.isFinite(number) || number <= 0) {
      setDraft(String(value))
      return
    }
    const next: number[] = [...settings.rewards[game]]
    next[index] = number
    updateSettings({ rewards: { [game]: next } })
  }
  return (
    <input
      type="number"
      min={1}
      step={10}
      value={draft}
      aria-label={`${settings[game].title} ${REWARD_TIERS[index + 1]?.name ?? ''} minimum score`}
      onChange={(event: ChangeEvent<HTMLInputElement>): void => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event): void => {
        if (event.key === 'Enter') commit()
      }}
    />
  )
}

export function RewardsPanel({ settings }: { settings: BoothSettings }): ReactElement {
  return (
    <section className="admin-card">
      <header>
        <div>
          <h2>Reward tiers</h2>
          <p>
            Minimum score for each tier. Players only see the tier name. These don&apos;t change
            with difficulty, so revisit them after changing a preset or the clock.
          </p>
        </div>
        <button
          type="button"
          className="quiet-button"
          onClick={(): void => updateSettings({ rewards: DEFAULTS.rewards })}
        >
          Reset
        </button>
      </header>
      <div className="table-scroll">
        <table className="tiers-table">
          <thead>
            <tr>
              <th>Game</th>
              {REWARD_TIERS.map((tier): ReactElement => (
                <th key={tier.name} style={{ color: tier.color }}>
                  {tier.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GAMES.map((game: GameId): ReactElement => (
              <tr key={game}>
                <th scope="row">{settings[game].title}</th>
                <td>0</td>
                {settings.rewards[game].map((value: number, index: number): ReactElement => (
                  <td key={index}>
                    <ThresholdInput game={game} index={index} value={value} settings={settings} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-help">
        Each tier needs a higher score than the one before it; lower values are bumped up. Credit
        amounts per tier stay internal.
      </p>
    </section>
  )
}
