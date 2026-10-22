import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { GameId } from '../arcade/games/types'
import { REWARD_TIERS } from '../arcade/rewards'
import { recentPlays, today, type LoggedPlay } from '../arcade/scores'
import type { BoothSettings } from '../lib/booth'

const CLAIMS_KEY: string = 'aspect-arcade-claimed-v1'
const GAMES: readonly GameId[] = ['snake', 'runner', 'shooter', 'jetpack']

/** A play logged by an older build had a play number instead of a code. */
type AnyPlay = LoggedPlay & { play?: number }

function readClaims(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CLAIMS_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted: number[] = [...values].sort((a: number, b: number): number => a - b)
  const middle: number = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
}

function localDay(iso: string): string {
  const date: Date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function playCode(play: AnyPlay): string {
  return play.id ?? (play.play ? `#${play.play}` : '—')
}

export function PlaysPanel({ settings }: { settings: BoothSettings }): ReactElement {
  const [plays, setPlays] = useState<AnyPlay[]>([])
  const [claims, setClaims] = useState<Record<string, string>>(readClaims)
  const [search, setSearch] = useState<string>('')

  useEffect((): (() => void) => {
    const refresh = (): void => {
      void recentPlays().then(setPlays)
    }
    refresh()
    const desktop: Window['aspectDesktop'] = window.aspectDesktop
    const stopListening: (() => void) | undefined = desktop?.onPlay(refresh)
    const onStorage = (event: StorageEvent): void => {
      if (event.key === CLAIMS_KEY) setClaims(readClaims())
      else refresh()
    }
    window.addEventListener('storage', onStorage)
    return (): void => {
      stopListening?.()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const toggleClaim = (code: string): void => {
    const next: Record<string, string> = { ...claims }
    if (next[code]) delete next[code]
    else next[code] = new Date().toISOString()
    setClaims(next)
    try {
      window.localStorage.setItem(CLAIMS_KEY, JSON.stringify(next))
    } catch {
      // Still marked for this session.
    }
  }

  const day: string = today()
  const todays: AnyPlay[] = useMemo(
    (): AnyPlay[] => plays.filter((play: AnyPlay): boolean => localDay(play.at) === day),
    [plays, day],
  )
  const query: string = search.trim().toUpperCase()
  const shown: AnyPlay[] = query
    ? plays.filter(
        (play: AnyPlay): boolean =>
          playCode(play).includes(query) || (play.initials ?? '').includes(query),
      )
    : plays.slice(0, 60)

  return (
    <>
      <section className="admin-card">
        <header>
          <div>
            <h2>Today</h2>
            <p>Use the typical game length to tune difficulty. The goal is 30–60 seconds.</p>
          </div>
        </header>
        <div className="stat-grid">
          {GAMES.map((game: GameId): ReactElement => {
            const games: AnyPlay[] = todays.filter((play: AnyPlay): boolean => play.game === game)
            const tiers: Map<string, number> = new Map()
            for (const play of games) tiers.set(play.tier, (tiers.get(play.tier) ?? 0) + 1)
            return (
              <div className="stat-card" key={game}>
                <h3>{settings[game].title}</h3>
                <dl>
                  <div>
                    <dt>Plays</dt>
                    <dd>{games.length}</dd>
                  </div>
                  <div>
                    <dt>Typical length</dt>
                    <dd>
                      {games.length
                        ? `${median(games.map((play: AnyPlay): number => play.durationSeconds))} s`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Longest</dt>
                    <dd>
                      {games.length
                        ? `${Math.max(...games.map((play: AnyPlay): number => play.durationSeconds))} s`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Typical score</dt>
                    <dd>
                      {games.length
                        ? median(games.map((play: AnyPlay): number => play.score))
                        : '—'}
                    </dd>
                  </div>
                </dl>
                <div className="tier-bar" aria-label="Tiers reached today">
                  {REWARD_TIERS.map((tier): ReactElement => (
                    <span key={tier.name} style={{ color: tier.color }}>
                      {tier.name[0]}
                      {tier.name.slice(1).toLowerCase()} {tiers.get(tier.name) ?? 0}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="admin-card">
        <header>
          <div>
            <h2>Look up a code</h2>
            <p>
              Each reward screen shows a four-character code. Find it here, check the tier, and mark
              it claimed so nobody claims it twice.
            </p>
          </div>
          {window.aspectDesktop && (
            <button
              type="button"
              className="quiet-button"
              onClick={(): void => window.aspectDesktop?.showPlayLog()}
            >
              Show log file
            </button>
          )}
        </header>
        <input
          className="code-search"
          type="search"
          placeholder="Code or initials, e.g. K7QD"
          value={search}
          spellCheck={false}
          autoComplete="off"
          onChange={(event): void => setSearch(event.currentTarget.value)}
        />
        <div className="table-scroll">
          <table className="plays-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Time</th>
                <th>Game</th>
                <th>Score</th>
                <th>Tier</th>
                <th>Initials</th>
                <th>Length</th>
                <th>Ended</th>
                <th>Difficulty</th>
                <th>Claimed</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty-row">
                    {query ? `No play matches “${query}”.` : 'No plays yet.'}
                  </td>
                </tr>
              )}
              {shown.map((play: AnyPlay, index: number): ReactElement => {
                const code: string = playCode(play)
                const claimed: string | undefined = claims[code]
                const tierColor: string | undefined = REWARD_TIERS.find(
                  (tier): boolean => tier.name === play.tier,
                )?.color
                return (
                  <tr key={`${code}-${play.at}-${index}`} data-claimed={Boolean(claimed)}>
                    <td className="code-cell">{code}</td>
                    <td>
                      {localDay(play.at) === day ? '' : `${localDay(play.at)} `}
                      {time(play.at)}
                    </td>
                    <td>{settings[play.game as GameId]?.title ?? play.game}</td>
                    <td>{play.score}</td>
                    <td style={{ color: tierColor }}>{play.tier}</td>
                    <td>{play.initials ?? '—'}</td>
                    <td>{play.durationSeconds} s</td>
                    <td>{play.endedBy}</td>
                    <td>{play.difficulty ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="claim-button"
                        aria-pressed={Boolean(claimed)}
                        onClick={(): void => toggleClaim(code)}
                        title={claimed ? `Claimed at ${time(claimed)}. Click to undo.` : undefined}
                      >
                        {claimed ? `Claimed ${time(claimed)}` : 'Mark claimed'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
