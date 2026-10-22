import { getSettings } from '../../lib/boothStore'
import { BOUNCE_COLORS } from '../../lib/bounce'
import {
  DANGER,
  GOLD,
  INK,
  draw,
  ellipse,
  logo,
  rect,
  seeded,
  sprite,
  text,
  textWidth,
} from '../pixel'

// Art for On Set: a camera on a dolly rolls across a film set, jumping cables and apple boxes and
// ducking boom mics. Every so often the crew slates a new scene and the set changes around it.

export type Prop = 'cable' | 'cStand' | 'appleBoxes' | 'light' | 'boomLow' | 'boomHigh'

/** Horizontal distance over which background features repeat. */
const PERIOD: number = 1000

function hex(color: string): [number, number, number] {
  const value: number = Number.parseInt(color.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** A color between a and b, t from 0 to 1. */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex(a)
  const [br, bg, bb] = hex(b)
  const channel = (from: number, to: number): number => Math.round(from + (to - from) * t)
  return `rgb(${channel(ar, br)} ${channel(ag, bg)} ${channel(ab, bb)})`
}

/** A sky in horizontal bands from top to bottom, which reads as a dithered 8-bit gradient. */
function sky(
  context: CanvasRenderingContext2D,
  width: number,
  bottom: number,
  top: string,
  low: string,
): void {
  const bands: number = 8
  const band: number = Math.ceil(bottom / bands)
  for (let index: number = 0; index < bands; index += 1) {
    rect(context, 0, index * band, width, band, mix(top, low, index / (bands - 1)))
  }
}

/** Where a repeating feature at world position x sits on screen, given how far the set scrolled. */
function scroll(x: number, distance: number, depth: number): number {
  return ((((x - distance * depth) % PERIOD) + PERIOD) % PERIOD) - 60
}

interface Feature {
  x: number
  width: number
  height: number
  seed: number
}

function features(
  seed: number,
  gapMin: number,
  gapMax: number,
  width: [number, number],
  height: [number, number],
): Feature[] {
  const random: () => number = seeded(seed)
  const list: Feature[] = []
  for (let x: number = 0; x < PERIOD - 60;) {
    const featureWidth: number = width[0] + Math.floor(random() * (width[1] - width[0]))
    list.push({
      x,
      width: featureWidth,
      height: height[0] + Math.floor(random() * (height[1] - height[0])),
      seed: Math.floor(random() * 1000),
    })
    x += featureWidth + gapMin + Math.floor(random() * (gapMax - gapMin))
  }
  return list
}

const starField: { x: number; y: number; phase: number }[] = (() => {
  const random: () => number = seeded(23)
  return Array.from({ length: 80 }, () => ({ x: random(), y: random(), phase: random() * 120 }))
})()

function stars(
  context: CanvasRenderingContext2D,
  width: number,
  bottom: number,
  distance: number,
  ticks: number,
  count: number,
  dim: string,
): void {
  for (const star of starField.slice(0, count)) {
    const x: number = (((star.x * width - distance * 0.03) % width) + width) % width
    const bright: boolean = (ticks + star.phase) % 120 < 6
    rect(context, x, star.y * (bottom - 8), 1, 1, bright ? INK : dim)
  }
}

export interface SceneSet {
  name: string
  groundLine: string
  groundFill: string
  groundMark: string
  background(
    context: CanvasRenderingContext2D,
    width: number,
    ground: number,
    distance: number,
    ticks: number,
  ): void
}

const stages: Feature[] = features(31, 10, 40, [46, 80], [26, 40])
const mesas: Feature[] = features(41, 30, 120, [40, 90], [14, 34])
const cacti: Feature[] = features(43, 60, 200, [7, 8], [12, 20])
const towers: Feature[] = features(53, 2, 8, [14, 36], [14, 48])
const craters: Feature[] = features(61, 40, 140, [30, 70], [6, 14])
const reefs: Feature[] = features(71, 20, 90, [20, 50], [8, 22])
const weeds: Feature[] = features(73, 18, 60, [3, 4], [12, 26])

export const SETS: readonly SceneSet[] = [
  {
    name: 'STUDIO LOT',
    groundLine: '#798cf2',
    groundFill: '#14161f',
    groundMark: '#a17f12',
    background(context, width, ground, distance, ticks): void {
      sky(context, width, ground, '#090b16', '#1d2344')
      stars(context, width, ground, distance, ticks, 30, '#2c3150')
      // Soundstages with big painted stage numbers.
      for (const stage of stages) {
        const x: number = scroll(stage.x, distance, 0.2)
        if (x > width || x + stage.width < 0) continue
        const top: number = ground - stage.height
        ellipse(context, x + stage.width / 2, top + 1, stage.width / 2, 5, '#161b33')
        rect(context, x, top, stage.width, stage.height, '#161b33')
        rect(context, x + 4, ground - 14, 12, 14, '#0f1326')
        text(context, String((stage.seed % 9) + 1), x + stage.width / 2 + 6, top + 6, '#2e3768', {
          scale: 2,
          shadow: false,
        })
      }
    },
  },
  {
    name: 'THE WILD WEST',
    groundLine: '#a8613a',
    groundFill: '#1f120e',
    groundMark: '#3b2418',
    background(context, width, ground, distance): void {
      // Late dusk: the sky stays dark down where the props are, so the orange cables, wooden
      // boxes, and gold reels stand out against it. The sun sits high, out of the play area.
      sky(context, width, ground, '#140a22', '#3d1d3c')
      const sunX: number = width * 0.72
      const sunY: number = Math.round(ground * 0.32)
      ellipse(context, sunX, sunY, 11, 11, '#d9604a')
      for (let stripe: number = 0; stripe < 3; stripe += 1) {
        rect(context, sunX - 12, sunY + 2 + stripe * 3, 24, 1 + Math.floor(stripe / 2), '#24112e')
      }
      for (const mesa of mesas) {
        const x: number = scroll(mesa.x, distance, 0.15)
        if (x > width || x + mesa.width < 0) continue
        // Flat tops with stepped, sloping sides.
        for (let row: number = 0; row < mesa.height; row += 1) {
          const inset: number = Math.max(0, 6 - Math.floor(row / 2))
          rect(context, x + inset, ground - mesa.height + row, mesa.width - inset * 2, 1, '#5b3352')
        }
      }
      for (const cactus of cacti) {
        const x: number = scroll(cactus.x, distance, 0.45)
        if (x > width || x < -10) continue
        const top: number = ground - cactus.height
        rect(context, x + 3, top, 3, cactus.height, '#0f070d')
        rect(context, x, top + 5, 2, 5, '#0f070d')
        rect(context, x, top + 9, 4, 2, '#0f070d')
        rect(context, x + 7, top + 3, 2, 5, '#0f070d')
        rect(context, x + 5, top + 7, 4, 2, '#0f070d')
      }
    },
  },
  {
    name: 'NEON CITY',
    groundLine: '#ec4899',
    groundFill: '#0b0d14',
    groundMark: '#2a3050',
    background(context, width, ground, distance, ticks): void {
      sky(context, width, ground, '#05060c', '#1a0f2e')
      stars(context, width, ground, distance, ticks, 40, '#3a3f55')
      for (const tower of towers) {
        const x: number = scroll(tower.x, distance, 0.25)
        if (x > width || x + tower.width < 0) continue
        const top: number = ground - tower.height
        rect(context, x, top, tower.width, tower.height, '#121628')
        for (let row: number = top + 4; row < ground - 4; row += 5) {
          for (let column: number = 3; column < tower.width - 3; column += 5) {
            const lit: number = (tower.seed + row * 7 + column * 13) % 11
            if (lit < 3) {
              const neon: string =
                lit === 0
                  ? (BOUNCE_COLORS[tower.seed % BOUNCE_COLORS.length] ?? '#ec4899')
                  : '#2c3466'
              rect(context, x + column, row, 2, 2, neon)
            }
          }
        }
      }
    },
  },
  {
    name: 'OUTER SPACE',
    groundLine: '#c9cede',
    groundFill: '#2b2e3a',
    groundMark: '#1f2230',
    background(context, width, ground, distance, ticks): void {
      rect(context, 0, 0, width, ground, '#03040a')
      stars(context, width, ground, distance, ticks, 80, '#4a4f63')
      // A ringed planet and a little moon.
      const planetX: number = width * 0.72
      const planetY: number = ground * 0.38
      ellipse(context, planetX, planetY, 13, 13, '#c0418a')
      ellipse(context, planetX - 4, planetY - 4, 5, 4, '#e06aa8')
      rect(context, planetX - 22, planetY, 44, 1, GOLD)
      rect(context, planetX - 18, planetY + 1, 36, 1, '#a17f12')
      ellipse(context, width * 0.22, ground * 0.25, 4, 4, '#8e93a2')
      for (const crater of craters) {
        const x: number = scroll(crater.x, distance, 0.2)
        if (x > width || x + crater.width < 0) continue
        ellipse(context, x + crater.width / 2, ground, crater.width / 2, crater.height, '#1c1f2a')
      }
    },
  },
  {
    name: 'UNDER THE SEA',
    groundLine: '#06b6d4',
    groundFill: '#1f3348',
    groundMark: '#2f4a66',
    background(context, width, ground, distance, ticks): void {
      sky(context, width, ground, '#0b3d6b', '#031225')
      // Slanted light rays from the surface.
      for (let ray: number = 0; ray < 4; ray += 1) {
        const startX: number = ((ray * 97 + ticks * 0.1) % (width + 40)) - 20
        for (let y: number = 0; y < ground; y += 2) {
          rect(context, startX + y * 0.4, y, 3, 2, 'rgb(120 200 255 / 6%)')
        }
      }
      for (const reef of reefs) {
        const x: number = scroll(reef.x, distance, 0.2)
        if (x > width || x + reef.width < 0) continue
        ellipse(context, x + reef.width / 2, ground, reef.width / 2, reef.height, '#0a2a4a')
      }
      for (const weed of weeds) {
        const x: number = scroll(weed.x, distance, 0.45)
        if (x > width || x < -6) continue
        for (let y: number = 0; y < weed.height; y += 1) {
          const sway: number = Math.round(Math.sin((ticks + weed.seed) / 20 + y / 4) * 2)
          rect(context, x + sway, ground - y, 2, 1, '#0f5a4a')
        }
      }
      // Bubbles rising.
      for (let bubble: number = 0; bubble < 12; bubble += 1) {
        const x: number = ((bubble * 53) % width) + Math.sin((ticks + bubble * 30) / 15) * 2
        const y: number = ground - (((ticks * 0.5 + bubble * 37) % ground) + 4)
        rect(context, x, y, 2, 2, 'rgb(180 230 255 / 40%)')
      }
    },
  },
]

/** The ground under the set: a colored edge and marks that scroll at full speed. */
export function drawGround(
  context: CanvasRenderingContext2D,
  set: SceneSet,
  width: number,
  height: number,
  ground: number,
  distance: number,
): void {
  rect(context, 0, ground + 1, width, height - ground, set.groundFill)
  // Bold edges (for a real TV) thicken the ground line so the floor reads from a distance.
  rect(context, 0, ground, width, getSettings().picture.boldEdges ? 2 : 1, set.groundLine)
  const offset: number = distance % 24
  for (let x: number = -offset; x < width; x += 24) {
    rect(context, x, ground + 4, 6, 1, set.groundMark)
    rect(context, x + 13, ground + 9, 3, 1, set.groundMark)
  }
}

export type Pose = 'stand' | 'duck' | 'air'

/**
 * The player: a film camera on a dolly, its body in the current bounce color with a little Aspect
 * logo on the side. Its footprint matches the runner's hitboxes.
 */
export function drawCamera(
  context: CanvasRenderingContext2D,
  x: number,
  bottom: number,
  color: string,
  pose: Pose,
  stride: number,
): void {
  const wheel = (wheelX: number, wheelY: number): void => {
    rect(context, wheelX, wheelY, 3, 3, '#c9cede')
    rect(context, wheelX + (stride ? 2 : 0), wheelY + (stride ? 2 : 0), 1, 1, '#3a3f55')
  }
  if (pose === 'duck') {
    rect(context, x + 2, bottom - 8, 12, 5, color)
    rect(context, x + 2, bottom - 8, 12, 1, 'rgb(255 255 255 / 35%)')
    draw(context, logo(5, 4, INK), x + 4, bottom - 7)
    rect(context, x + 14, bottom - 7, 3, 3, '#3a3f55')
    rect(context, x + 17, bottom - 8, 1, 5, '#8e93a2')
    rect(context, x + 1, bottom - 3, 16, 1, '#6b7085')
    wheel(x + 2, bottom - 3)
    wheel(x + 12, bottom - 3)
    return
  }
  // Two film reels on top.
  ellipse(context, x + 5, bottom - 13, 3, 2, '#c9cede')
  ellipse(context, x + 11, bottom - 13, 3, 2, '#c9cede')
  rect(context, x + 5, bottom - 13, 1, 1, '#3a3f55')
  rect(context, x + 11, bottom - 13, 1, 1, '#3a3f55')
  // Body, lens, and matte box.
  rect(context, x + 3, bottom - 10, 10, 6, color)
  rect(context, x + 3, bottom - 10, 10, 1, 'rgb(255 255 255 / 35%)')
  draw(context, logo(5, 4, INK), x + 5, bottom - 9)
  rect(context, x + 13, bottom - 9, 3, 4, '#3a3f55')
  rect(context, x + 16, bottom - 10, 1, 6, '#8e93a2')
  // Dolly.
  rect(context, x + 2, bottom - 4, 13, 1, '#6b7085')
  wheel(x + 3, bottom - 3)
  wheel(x + 11, bottom - 3)
}

/** Draws a set piece. Its box matches the runner's obstacle sizes. */
export function drawProp(
  context: CanvasRenderingContext2D,
  prop: Prop,
  x: number,
  top: number,
  width: number,
  height: number,
  ticks: number,
): void {
  switch (prop) {
    case 'cable': {
      // A coiled orange stinger with its plug sticking out.
      ellipse(context, x + 5, top + 5, 5, 2, '#f59e0b')
      ellipse(context, x + 5, top + 4, 3, 1, '#b45309')
      ellipse(context, x + 5, top + 3, 4, 2, '#f59e0b')
      rect(context, x + 4, top + 3, 3, 1, '#7c3a06')
      rect(context, x + 9, top + 6, 2, 2, '#c9cede')
      break
    }
    case 'cStand': {
      rect(context, x + 5, top + 1, 2, height - 2, '#c9cede')
      rect(context, x + 4, top + 3, 4, 3, '#6b7085')
      rect(context, x + 6, top + 2, 6, 1, '#c9cede')
      rect(context, x + 9, top, 3, 5, '#1b1e2b')
      rect(context, x + 5, top + 9, 2, 1, DANGER)
      // Turtle-base legs.
      rect(context, x, top + height - 1, width, 1, '#c9cede')
      rect(context, x + 2, top + height - 3, 2, 2, '#c9cede')
      rect(context, x + 8, top + height - 3, 2, 2, '#c9cede')
      break
    }
    case 'appleBoxes': {
      rect(context, x, top + 5, width, 6, '#b07a3c')
      rect(context, x + 4, top, 14, 5, '#c98d48')
      rect(context, x, top + 5, width, 1, '#6b4520')
      rect(context, x + 4, top, 14, 1, '#6b4520')
      rect(context, x + 8, top + 7, 6, 2, '#4a2f14')
      rect(context, x + 9, top + 2, 4, 1, '#4a2f14')
      break
    }
    case 'light': {
      // A film light on a tripod, aimed back at the camera: barn doors, a white lens, cooling fins,
      // and a faint beam. White and steel, never gold, so it can't be mistaken for a reel.
      const lens: string = Math.floor(ticks / 10) % 2 === 0 ? INK : '#e0f2fe'
      for (let reach: number = 1; reach <= 14; reach += 1) {
        // The beam widens and fades as it leaves the lens.
        context.globalAlpha = 0.3 * (1 - reach / 15)
        const spread: number = Math.floor(reach / 3)
        rect(context, x + 1 - reach, top + 2 - spread, 1, 4 + spread * 2, '#e0f2fe')
      }
      context.globalAlpha = 1
      // Barn doors angled open at the front.
      rect(context, x, top, 3, 1, '#6b7085')
      rect(context, x, top + 7, 3, 1, '#6b7085')
      // Housing with a lit edge and fins on the back.
      rect(context, x + 2, top + 1, 9, 6, '#3a3f55')
      rect(context, x + 2, top + 1, 9, 1, '#8e93a2')
      rect(context, x + 7, top + 3, 1, 3, '#1b1e2b')
      rect(context, x + 9, top + 3, 1, 3, '#1b1e2b')
      rect(context, x + 11, top + 3, 1, 2, '#6b7085')
      rect(context, x + 1, top + 1, 2, 6, lens)
      // Stand: pole and three splayed legs.
      rect(context, x + 6, top + 7, 1, 4, '#8e93a2')
      rect(context, x + 5, top + 11, 3, 1, '#8e93a2')
      rect(context, x + 3, top + 12, 2, 1, '#8e93a2')
      rect(context, x + 6, top + 12, 1, 1, '#8e93a2')
      rect(context, x + 8, top + 12, 2, 1, '#8e93a2')
      break
    }
    case 'boomLow':
    case 'boomHigh': {
      // A fuzzy windscreen on a pole that reaches up off the top of the screen.
      for (let y: number = top + 4; y >= 0; y -= 1) {
        const poleX: number = x + 17 + Math.round((top + 4 - y) * 0.5)
        rect(context, poleX, y, 1, 1, '#6b7085')
      }
      ellipse(context, x + 8, top + 6, 8, 4, '#8e93a2')
      for (let fuzz: number = 0; fuzz < 16; fuzz += 2) {
        rect(
          context,
          x + fuzz + ((ticks >> 3) & 1),
          top + 2 + (fuzz % 4 === 0 ? 0 : 1),
          1,
          1,
          '#c9cede',
        )
      }
      rect(context, x + 15, top + 5, 3, 3, '#1b1e2b')
      break
    }
  }
}

/** Film reels to collect, spinning. */
export const REEL_FRAMES: readonly HTMLCanvasElement[] = [
  ['.yyyy.', 'yY..Yy', 'y.yy.y', 'y.yy.y', 'yY..Yy', '.yyyy.'],
  ['.yyyy.', 'y.YY.y', 'yYyyYy', 'yYyyYy', 'y.YY.y', '.yyyy.'],
].map((rows: string[]): HTMLCanvasElement => sprite(rows, { y: GOLD, Y: '#fde68a' }))

/**
 * A clapperboard centered at x with its top at y. Open is how far the clapper stick is raised,
 * from 0 (snapped shut) to 1.
 */
export function drawSlate(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  title: string,
  subtitle: string,
  open: number,
): void {
  const width: number = Math.max(56, textWidth(subtitle) + 10, textWidth(title, 2) + 10)
  const left: number = Math.round(x - width / 2)
  const bodyTop: number = y + 7
  // The stick hinges on the left and lifts on the right.
  for (let column: number = 0; column < width; column += 1) {
    const raise: number = Math.round(open * 8 * (column / width))
    const stripe: boolean = Math.floor((column + 2) / 5) % 2 === 0
    rect(context, left + column, y + 1 - raise, 1, 5, stripe ? INK : '#111318')
  }
  const titleScale: number = textWidth(title, 2) <= width - 6 ? 2 : 1
  rect(context, left, bodyTop, width, 28, '#111318')
  rect(context, left, bodyTop, width, 1, INK)
  rect(context, left, bodyTop + 17, width, 1, '#4a4f63')
  text(context, title, x, bodyTop + (titleScale === 2 ? 2 : 6), INK, {
    scale: titleScale,
    align: 'center',
    shadow: false,
  })
  text(context, subtitle, x, bodyTop + 19, GOLD, { align: 'center', shadow: false })
}
