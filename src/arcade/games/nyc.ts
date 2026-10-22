import { ellipse, outlined, rect, seeded } from '../pixel'

// Art for Bodega Blaster: a Checker cab seen from above, and the city's pests diving at it head-on.
// Every sprite has a solid black outline so its shape survives a soft CRT.

export type Pest = 'pigeon' | 'pizza' | 'rat' | 'roach'

// The cab from above, nose up: bumpers, hood, wheels, windshield, mirrors, roof light, trunk.
const CAB_ROWS: readonly string[] = [
  '...bbbbbbb...',
  '..hyyyyyyyh..',
  '.yyyyyyyyyyy.',
  'kyyyyyyyyyyyk',
  'kyyyyyyyyyyyk',
  'kyygggggggyyk',
  '.yGggggggggy.',
  'myyyyyyyyyyym',
  '.yyyyoooyyyy.',
  '.yyyyyyyyyyy.',
  '.kwkwkwkwkwk.',
  '.yyyyyyyyyyy.',
  '.yygggggggyy.',
  'kyyyyyyyyyyyk',
  'kyyyyyyyyyyyk',
  'kyyyyyyyyyyyk',
  '.ryyyyyyyyyr.',
  '..bbbbbbbbb..',
]
const CAB_PALETTE: Record<string, string> = {
  b: '#c9cede',
  h: '#fffbe0',
  y: '#ffd21a',
  k: '#15161c',
  g: '#1d2f55',
  G: '#9cc8ff',
  m: '#ffd21a',
  o: '#ff6319',
  w: '#ffffff',
  r: '#ff3030',
}

const PIGEON_PALETTE: Record<string, string> = {
  w: '#d7dbe6',
  h: '#8a90a3',
  o: '#ff9a3c',
  b: '#f2e2c4',
  g: '#2fbf86',
  G: '#a3a9bc',
  t: '#6b7085',
}
const PIGEON_ROWS: readonly (readonly string[])[] = [
  [
    'w.............w',
    'ww....hhh....ww',
    'www..hoboh..www',
    '.wwwwgGGGgwwww.',
    '..wwwgGGGgwww..',
    '....ggGGGgg....',
    '.....gGGGg.....',
    '......ggg......',
    '.....ttttt.....',
  ],
  [
    '...............',
    '......hhh......',
    '.....hoboh.....',
    '..wwwgGGGgwww..',
    '.wwwwgGGGgwwww.',
    'www..gGGGg..www',
    'ww...gGGGg...ww',
    'w.....ggg.....w',
    '.....ttttt.....',
  ],
]

const PIZZA_ROWS: readonly string[] = [
  'ccccccccccccc',
  'cCCCCCCCCCCCc',
  '.yyyyyyyyyyy.',
  '.yyEEyyyEEyy.',
  '..yEKyyyEKy..',
  '..yyyyyyyyy..',
  '...yRRyRRy...',
  '....yyyyy....',
  '....yyRyy....',
  '.....yyy.....',
  '......y......',
]
const PIZZA_PALETTE: Record<string, string> = {
  c: '#a8682a',
  C: '#e0a055',
  y: '#ffd21a',
  E: '#ffffff',
  K: '#000000',
  R: '#e02424',
}

const RAT_PALETTE: Record<string, string> = {
  e: '#6b6476',
  p: '#ff8fa3',
  g: '#8f879c',
  R: '#ff2b2b',
  w: '#e6e9f2',
  W: '#ffffff',
}
const RAT_ROWS: readonly (readonly string[])[] = [
  [
    '.ee.......ee.',
    'eppe.....eppe',
    'eppgggggggppe',
    '.eggggggggge.',
    '..gRgggggRg..',
    '..ggggggggg..',
    'w..ggggggg..w',
    '.ww.ggpgg.ww.',
    '.....gWg.....',
    '......W......',
  ],
  [
    '.ee.......ee.',
    'eppe.....eppe',
    'eppgggggggppe',
    '.eggggggggge.',
    '..gRgggggRg..',
    '..ggggggggg..',
    '.w.ggggggg.w.',
    'w.w.ggpgg.w.w',
    '.....gWg.....',
    '......W......',
  ],
]

// A cockroach from above, head toward the player, legs scuttling.
const ROACH_PALETTE: Record<string, string> = {
  b: '#6e3818',
  B: '#b5652a',
  h: '#40220d',
  w: '#ffffff',
  l: '#d39a66',
  a: '#e3b48a',
}
const ROACH_ROWS: readonly (readonly string[])[] = [
  [
    'l..bbbbb..l',
    '.l.bBBBb.l.',
    '..lbBBBbl..',
    '...bBBBb...',
    'llbBBBBBbll',
    '..bBBBBBb..',
    '...bBBBb...',
    'llbbBBBbbll',
    '...hhhhh...',
    '...hwhwh...',
    '..a.....a..',
    '.a.......a.',
    'a.........a',
  ],
  [
    '.l.bbbbb.l.',
    'l..bBBBb..l',
    '..lbBBBbl..',
    '...bBBBb...',
    '.lbBBBBBbl.',
    '..bBBBBBb..',
    '...bBBBb...',
    '.lbbBBBbbl.',
    '...hhhhh...',
    '...hwhwh...',
    '...a...a...',
    '..a.....a..',
    '.a.......a.',
  ],
]

let cache: {
  cab: HTMLCanvasElement
  pests: Record<Pest, HTMLCanvasElement[]>
} | null = null

/** Sprites are built on first use, after the page has a canvas to draw into. */
function sprites(): NonNullable<typeof cache> {
  cache ??= {
    cab: outlined(CAB_ROWS, CAB_PALETTE),
    pests: {
      pigeon: PIGEON_ROWS.map((rows) => outlined(rows, PIGEON_PALETTE)),
      pizza: [outlined(PIZZA_ROWS, PIZZA_PALETTE)],
      rat: RAT_ROWS.map((rows) => outlined(rows, RAT_PALETTE)),
      roach: ROACH_ROWS.map((rows) => outlined(rows, ROACH_PALETTE)),
    },
  }
  return cache
}

/** How fast each pest animates, in ticks per frame. */
const FRAME_TICKS: Record<Pest, number> = { pigeon: 8, pizza: 16, rat: 12, roach: 5 }

function blit(
  context: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  x: number,
  y: number,
): void {
  context.drawImage(image, Math.round(x - image.width / 2), Math.round(y - image.height / 2))
}

/** Draws the cab centered on (x, y). */
export function drawCab(context: CanvasRenderingContext2D, x: number, y: number): void {
  blit(context, sprites().cab, x, y)
}

/** A small cab for the lives counter, at half size. */
export function drawLifeCab(context: CanvasRenderingContext2D, x: number, y: number): void {
  const cab: HTMLCanvasElement = sprites().cab
  context.drawImage(
    cab,
    Math.round(x),
    Math.round(y),
    Math.ceil(cab.width / 2),
    Math.ceil(cab.height / 2),
  )
}

/** Draws a pest centered on (x, y). The seed staggers animation so a formation doesn't move in lockstep. */
export function drawPest(
  context: CanvasRenderingContext2D,
  pest: Pest,
  x: number,
  y: number,
  ticks: number,
  seed: number,
): void {
  const frames: HTMLCanvasElement[] = sprites().pests[pest]
  const frame: number = (Math.floor(ticks / FRAME_TICKS[pest]) + seed) % frames.length
  // The pizza has one frame and bobs instead.
  const bob: number = pest === 'pizza' ? (Math.floor(ticks / 16) + seed) % 2 : 0
  blit(context, frames[frame] ?? frames[0]!, x, y + bob)
}

/**
 * Pizza Rat, the bonus target: the rat dragging a slice behind it, side by side so it only needs
 * a thin lane across the top of the screen. The rat is at (x, y); dir is the way it's heading.
 */
export function drawPizzaRat(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: 1 | -1,
  ticks: number,
): void {
  blit(context, sprites().pests.pizza[0]!, x - dir * 13, y + (Math.floor(ticks / 8) % 2))
  drawPest(context, 'rat', x, y, ticks, 0)
}

interface Building {
  x: number
  width: number
  height: number
  windows: { x: number; y: number }[]
}

let skyline: { width: number; buildings: Building[] } | null = null

function buildings(width: number): Building[] {
  if (skyline?.width === width) return skyline.buildings
  const random: () => number = seeded(85)
  const list: Building[] = []
  let x: number = 0
  while (x < width) {
    const buildingWidth: number = 12 + Math.floor(random() * 14)
    const height: number = 14 + Math.floor(random() * 22)
    const windows: { x: number; y: number }[] = []
    for (let wy: number = 4; wy < height - 3; wy += 6) {
      for (let wx: number = 3; wx < buildingWidth - 4; wx += 5) {
        if (random() < 0.18) windows.push({ x: wx, y: wy })
      }
    }
    list.push({ x, width: buildingWidth, height, windows })
    x += buildingWidth
  }
  skyline = { width, buildings: list }
  return list
}

/** Height of the street along the bottom of the screen. */
export const STREET_HEIGHT: number = 10

/**
 * The night city behind the game. It stays dark and flat on purpose, so the sprites in front of
 * it are the brightest, sharpest things on screen.
 */
export function drawCity(context: CanvasRenderingContext2D, width: number, height: number): void {
  rect(context, 0, 0, width, height, '#070a1f')
  ellipse(context, Math.round(width * 0.1), 26, 6, 6, '#e9e3c4')
  const base: number = height - STREET_HEIGHT
  for (const building of buildings(width)) {
    rect(
      context,
      building.x,
      base - building.height,
      building.width - 1,
      building.height,
      '#141938',
    )
    for (const window of building.windows) {
      rect(context, building.x + window.x, base - building.height + window.y, 2, 2, '#4a4422')
    }
  }
  // A tall tower with a spire, a little right of center.
  const spire: number = Math.round(width / 2 + width * 0.18)
  rect(context, spire - 5, base - 46, 10, 46, '#141938')
  rect(context, spire - 3, base - 54, 6, 8, '#141938')
  rect(context, spire - 1, base - 62, 2, 8, '#141938')
  rect(context, 0, base, width, STREET_HEIGHT, '#0e0f14')
  for (let x: number = 0; x < width; x += 16) rect(context, x, base + 5, 8, 1, '#4a4216')
}
