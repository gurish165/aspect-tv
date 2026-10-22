import { getSettings } from '../lib/boothStore'
import type { GameId } from './games/types'

// Placeholder reward tiers. Staff decide the actual prize at the booth; credit amounts stay
// internal, so the screen shows only the tier unless SHOW_CREDITS is turned on.
export const SHOW_CREDITS: boolean = false

export interface RewardTier {
  name: string
  color: string
  credits: number
}

export const REWARD_TIERS: readonly RewardTier[] = [
  { name: 'ROOKIE', color: '#8e93a2', credits: 0 },
  { name: 'BRONZE', color: '#d08a4a', credits: 0 },
  { name: 'SILVER', color: '#c9d1e3', credits: 0 },
  { name: 'GOLD', color: '#eab308', credits: 0 },
  { name: 'LEGEND', color: '#ec4899', credits: 0 },
]

export interface RewardResult {
  tier: RewardTier
  level: number
  next: { tier: RewardTier; pointsNeeded: number } | null
}

/** Tiers by score. Staff set the minimums for every tier above Rookie in the admin window. */
export function rewardFor(game: GameId, score: number): RewardResult {
  const thresholds: readonly number[] = [0, ...getSettings().rewards[game]]
  let level: number = 0
  thresholds.forEach((minimum: number, index: number): void => {
    if (score >= minimum) level = index
  })
  const tier: RewardTier = REWARD_TIERS[level] ?? REWARD_TIERS[0]!
  const nextTier: RewardTier | undefined = REWARD_TIERS[level + 1]
  const nextMinimum: number | undefined = thresholds[level + 1]
  return {
    tier,
    level,
    next:
      nextTier && nextMinimum !== undefined
        ? { tier: nextTier, pointsNeeded: nextMinimum - score }
        : null,
  }
}
