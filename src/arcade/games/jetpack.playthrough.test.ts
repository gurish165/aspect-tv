// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type DifficultyName, JETPACK_PRESETS, defaultSettings } from '../../lib/booth'
import { updateSettings } from '../../lib/boothStore'
import { seeded, stage } from '../pixel'
import { inputFrame, silentSound } from '../testing'
import { JETPACK, type PlanView } from './jetpack'
import { clearHorizon, findRoute } from './jetpackPlan'

// Long automated runs of Fix It In Post. A bot flies with the same route finder the game uses to
// vet new hazards, replanning every few ticks. If the hazards are always fair, it never meets a
// moment with no way through, and it never crashes on the plain jetpack.

interface Result {
  meters: number
  crashes: number
  /** Moments where no route existed from where the bot was. */
  stuck: { meters: number; tick: number }[]
}

/** The game, seen through the planner view it offers for exactly this. */
type Playable = ReturnType<typeof JETPACK.create> & { planView(): PlanView }

function playthrough(seed: number, preset: DifficultyName, target: number): Result {
  vi.spyOn(Math, 'random').mockImplementation(seeded(seed))
  updateSettings(defaultSettings())
  updateSettings({ jetpack: JETPACK_PRESETS[preset] })
  const game = JETPACK.create(silentSound, 0) as Playable
  const stuck: Result['stuck'] = []
  let route: boolean[] = []
  let sincePlan: number = 0
  let wasHeld: boolean = false
  let hazardCount: number = -1
  for (let tick: number = 0; tick < 60 * 900 && !game.over; tick += 1) {
    const view = game.planView()
    if (view.meters >= target) break
    let held: boolean = false
    if (view.running && view.suit === 'jetpack') {
      const count: number =
        view.hazards.wires.length + view.hazards.lasers.length + view.hazards.notes.length
      sincePlan += 1
      if (route.length === 0 || sincePlan >= 8 || count !== hazardCount) {
        hazardCount = count
        sincePlan = 0
        const horizon: number = Math.max(30, clearHorizon(view.world, view.hazards, 240))
        // Fly like a careful player: the widest clearance that still gets through.
        let found: boolean[] | null = null
        for (const margin of [5, 3, 1]) {
          found = findRoute(view.world, view.hazards, view.start, view.feel, horizon, {
            margin,
            fine: true,
          })
          if (found) break
        }
        // Only a moment where even a no-clearance, exhaustive search fails is truly unwinnable.
        found ??= findRoute(view.world, view.hazards, view.start, view.feel, horizon, {
          margin: 0,
          beam: 30000,
          fine: true,
        })
        if (!found) stuck.push({ meters: view.meters, tick })
        route = found ?? []
      }
      held = route.shift() ?? false
    } else {
      // In a suit, during the suit-up, or after a crash: just keep tapping.
      held = tick % 40 < 10
      route = []
    }
    game.update(inputFrame(held && !wasHeld ? ['fly', 'confirm'] : [], held ? ['fly'] : []))
    wasHeld = held
  }
  const end = game.planView()
  return { meters: end.meters, crashes: end.crashes, stuck }
}

// The long runs take a few minutes, so they run with npm run test:playthrough; npm test runs a
// shorter one.
const full: boolean = process.env['PLAYTHROUGH'] === '1'

describe('Fix It In Post playthroughs', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks()
    stage.width = 312
    stage.height = 178
  })

  const runs: readonly (readonly [DifficultyName, number, number])[] = full
    ? [
        ['normal', 1, 4000],
        ['normal', 2, 4000],
        ['normal', 3, 4000],
        ['hard', 6, 4000],
        ['expert', 4, 4000],
        ['expert', 5, 4000],
      ]
    : [['hard', 6, 1500]]
  for (const [preset, seed, target] of runs) {
    it(`flies past ${target} m on ${preset} (seed ${seed}) without an unwinnable moment`, (): void => {
      stage.width = 312
      stage.height = 178
      const result: Result = playthrough(seed, preset, target)
      console.log(
        `${preset} seed ${seed}: ${result.meters} m, ${result.crashes} crashes, stuck at`,
        result.stuck,
      )
      expect(result.stuck).toEqual([])
      expect(result.crashes).toBe(0)
      expect(result.meters).toBeGreaterThanOrEqual(target)
    }, 300_000)
  }
})
