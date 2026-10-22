import type { GameId } from './games/types'

// Today's high scores, kept on this machine. The board starts fresh each day of the show.

export interface ScoreEntry {
  game: GameId
  initials: string
  score: number
  day: string
  at: string
}

export type EndReason = 'game over' | 'time' | 'quit'

export interface PlayRecord {
  game: GameId
  score: number
  tier: string
  credits: number
  initials: string | null
  durationSeconds: number
  endedBy: EndReason
  /** The difficulty preset in use, or 'custom'. */
  difficulty: string
  /** The time limit in seconds, or 0 when off. */
  timeLimit: number
  at: string
}

/** A logged play with the claim code shown on the reward screen. */
export interface LoggedPlay extends PlayRecord {
  id: string
}

const SCORES_KEY: string = 'aspect-arcade-scores-v1'
const PLAYS_KEY: string = 'aspect-arcade-plays-v1'
/** Today's board: the top 10 per game, which also decides who enters initials. */
export const BOARD_SIZE: number = 10
const KEPT_PLAYS: number = 500

// Claim codes skip vowels, so they never spell words, and skip 0, O, 1, and I, which look alike.
export const CODE_ALPHABET: string = 'BCDFGHJKLMNPQRSTVWXZ23456789'
export const CODE_LENGTH: number = 4

export function newPlayCode(
  taken: ReadonlySet<string>,
  random: () => number = Math.random,
): string {
  for (;;) {
    let code: string = ''
    for (let index: number = 0; index < CODE_LENGTH; index += 1) {
      code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)] ?? 'B'
    }
    if (!taken.has(code)) return code
  }
}

function readEntries(): ScoreEntry[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SCORES_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as ScoreEntry[]) : []
  } catch {
    return []
  }
}

let entries: ScoreEntry[] = readEntries()

// The admin window can clear the board, so pick up changes made in another window.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event: StorageEvent): void => {
    if (event.key === SCORES_KEY || event.key === null) entries = readEntries()
  })
}

function writeEntries(): void {
  try {
    window.localStorage.setItem(SCORES_KEY, JSON.stringify(entries))
  } catch {
    // The board still works for this session.
  }
}

export function today(): string {
  const now: Date = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function topScores(game: GameId, limit: number = BOARD_SIZE): ScoreEntry[] {
  const day: string = today()
  return entries
    .filter((entry: ScoreEntry): boolean => entry.game === game && entry.day === day)
    .sort((a: ScoreEntry, b: ScoreEntry): number => b.score - a.score || a.at.localeCompare(b.at))
    .slice(0, limit)
}

export function bestScore(game: GameId): number {
  return topScores(game, 1)[0]?.score ?? 0
}

/** The board rank (1-based) a score would take today, or null if it misses the board. */
export function rankFor(game: GameId, score: number): number | null {
  if (score <= 0) return null
  const board: ScoreEntry[] = topScores(game)
  const index: number = board.findIndex((entry: ScoreEntry): boolean => score > entry.score)
  if (index >= 0) return index + 1
  return board.length < BOARD_SIZE ? board.length + 1 : null
}

export function addScore(game: GameId, initials: string, score: number): void {
  const day: string = today()
  entries.push({ game, initials, score, day, at: new Date().toISOString() })
  // Keep a short history per game and day so storage stays small.
  const kept: ScoreEntry[] = []
  for (const id of new Set(entries.map((entry: ScoreEntry): GameId => entry.game))) {
    for (const date of new Set(entries.map((entry: ScoreEntry): string => entry.day))) {
      kept.push(
        ...entries
          .filter((entry: ScoreEntry): boolean => entry.game === id && entry.day === date)
          .sort((a: ScoreEntry, b: ScoreEntry): number => b.score - a.score)
          .slice(0, 20),
      )
    }
  }
  entries = kept
  writeEntries()
}

export function clearTodaysScores(): void {
  const day: string = today()
  entries = entries.filter((entry: ScoreEntry): boolean => entry.day !== day)
  writeEntries()
}

export function todaysScoreCount(): number {
  const day: string = today()
  return entries.filter((entry: ScoreEntry): boolean => entry.day === day).length
}

function readBrowserPlays(): LoggedPlay[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PLAYS_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as LoggedPlay[]) : []
  } catch {
    return []
  }
}

/** Logs a finished play and resolves to its claim code, which staff can look up later. */
export async function recordPlay(play: PlayRecord): Promise<string> {
  const desktop: Window['aspectDesktop'] = window.aspectDesktop
  if (desktop) {
    try {
      return await desktop.recordPlay(play)
    } catch {
      // Fall through to the browser log.
    }
  }
  const plays: LoggedPlay[] = readBrowserPlays()
  const id: string = newPlayCode(new Set(plays.map((logged: LoggedPlay): string => logged.id)))
  try {
    window.localStorage.setItem(
      PLAYS_KEY,
      JSON.stringify([{ id, ...play }, ...plays].slice(0, KEPT_PLAYS)),
    )
  } catch {
    // The code still shows on screen.
  }
  return id
}

/** The most recent plays, newest first. */
export async function recentPlays(): Promise<LoggedPlay[]> {
  const desktop: Window['aspectDesktop'] = window.aspectDesktop
  if (desktop) {
    try {
      return await desktop.recentPlays()
    } catch {
      return []
    }
  }
  return readBrowserPlays()
}
