import { INK, ellipse, logo, outlined, rect, text, textWidth } from '../pixel'

// Art for Fix It In Post: an editor with a jetpack flying through a post-production house.
// Sprites carry a solid black outline so their shapes survive a soft CRT; the rooms behind them
// stay dark and flat.

export type Suit = 'jetpack' | 'rig' | 'dragon' | 'hog' | 'jumpCut' | 'flip'

/** The five suits a ? box can hold, in the order the admin window and README list them. */
export const SUITS: readonly Exclude<Suit, 'jetpack'>[] = [
  'rig',
  'dragon',
  'hog',
  'jumpCut',
  'flip',
]

export const SUIT_NAMES: Record<Suit, string> = {
  jetpack: 'JETPACK',
  rig: 'THE RIG',
  dragon: 'ROBO DRAGON',
  hog: 'ROAD HOG',
  jumpCut: 'JUMP CUT',
  flip: 'FLIP SUIT',
}

// The editor, facing right: headphones, hoodie, jetpack on the back.
const HERO_TOP: readonly string[] = [
  '...hhhh....',
  '..Phhhhh...',
  '.PPhfffff..',
  '.PPffffEf..',
  '..Pfffffff.',
  '...ffff....',
  'GGSSSSSS...',
  'GGSSSSSSf..',
  'GGSSSSSff..',
  'GGSSSSSS...',
  'GGSSSSSS...',
  '.gJJJJJJ...',
]
const HERO_LEGS: Record<'runA' | 'runB' | 'fly', readonly string[]> = {
  runA: ['..JJ..JJ...', '..JJ...JJ..', '.JJ....JJ..', '.KK....KKK.'],
  runB: ['...JJJJ....', '...JJJJ....', '...JJ.JJ...', '..KKK.KKK..'],
  fly: ['..JJJJ.....', '..JJJJ.....', '..JJJJ.....', '..KKKK.....'],
}
const HERO_PALETTE: Record<string, string> = {
  h: '#4a2c1a',
  P: '#6366f1',
  f: '#f1c27d',
  E: '#15161c',
  G: '#9aa0b4',
  g: '#5b6075',
  S: '#798cf2',
  J: '#2b3a67',
  K: '#f2f2f2',
}
// The Flip Suit is the same figure in a silver spacesuit.
const FLIP_PALETTE: Record<string, string> = {
  ...HERO_PALETTE,
  h: '#e6e9f2',
  P: '#22d3ee',
  S: '#c9cede',
  J: '#9aa0b4',
  K: '#22d3ee',
  G: '#22d3ee',
}

const RIG_ROWS: readonly (readonly string[])[] = [
  [
    '.....kkkkkk.....',
    '.....kkkkkkLLL..',
    '.....kRkkkkLLL..',
    '.....kkkkkk.....',
    '...MMMMMMMMMM...',
    '..MMMwwwwwwMMM..',
    '..MMMwffffwMMM..',
    '.MM.MMMMMMMM.MM.',
    '.MM.MMMMMMMM.MM.',
    '.ss..MMMMMM..ss.',
    '.....MM..MM.....',
    '.....MM..MM.....',
    '....MMM..MMM....',
    '...MMMM..MMMM...',
  ],
  [
    '.....kkkkkk.....',
    '.....kkkkkkLLL..',
    '.....kRkkkkLLL..',
    '.....kkkkkk.....',
    '...MMMMMMMMMM...',
    '..MMMwwwwwwMMM..',
    '..MMMwffffwMMM..',
    '.MM.MMMMMMMM.MM.',
    '.MM.MMMMMMMM.MM.',
    '.ss..MMMMMM..ss.',
    '....MM....MM....',
    '....MM....MM....',
    '...MMM....MMM...',
    '..MMMM....MMMM..',
  ],
]
const RIG_PALETTE: Record<string, string> = {
  k: '#3a3f55',
  L: '#9cc8ff',
  R: '#ff3030',
  M: '#f59e0b',
  w: '#9cc8ff',
  f: '#f1c27d',
  s: '#c9cede',
}

const DRAGON_ROWS: readonly (readonly string[])[] = [
  [
    '..............bb......',
    '.............bbbb.....',
    '......ss.....bbEbbb...',
    '.....ssss...bbbbbbbbb.',
    '....sssssss.bbbbbtttt.',
    '...bbbbbbbbbbbbb......',
    '..bbbbbbbbbbbbb.......',
    'bbbbbbbbbbbbbb........',
    'b..bbbbbbbbbb.........',
    '....bb...bb...........',
    '....bb...bb...........',
  ],
  [
    '..............bb......',
    '.............bbbb.....',
    '.............bbEbbb...',
    '............bbbbbbbbb.',
    '............bbbbbtttt.',
    '...bbbbbbbbbbbbb......',
    '..bbbsssssbbbbb.......',
    'bbbbsssssbbbbb........',
    'b..bbbbbbbbbb.........',
    '....bb...bb...........',
    '....bb...bb...........',
  ],
]
const DRAGON_PALETTE: Record<string, string> = {
  b: '#2fbf86',
  s: '#a7f3d0',
  E: '#ff3030',
  t: '#ffffff',
}

const HOG_ROWS: readonly string[] = [
  '.......HHH..........',
  '......HHHHv.........',
  '.......SSS..........',
  '......SSSSSff.......',
  '..ttt.SSSS..hh......',
  '.tttRRRRRRRRRhh.....',
  '..RRRRRRRRRRRRRgggg.',
  '.WWW.RRRRRRR.WWW....',
  'WWwWW.......WWwWW...',
  '.WWW.........WWW....',
]
const HOG_PALETTE: Record<string, string> = {
  H: '#ef4444',
  v: '#9cc8ff',
  S: '#3a3f55',
  f: '#f1c27d',
  h: '#c9cede',
  t: '#9aa0b4',
  R: '#a855f7',
  g: '#6b7085',
  W: '#5b6075',
  w: '#c9cede',
}

const KEYFRAME_ROWS: readonly (readonly string[])[] = [
  ['..y..', '.yYy.', 'yYYYy', '.yYy.', '..y..'],
  ['..y..', '..Y..', '.yYy.', '..Y..', '..y..'],
  ['..y..', '..y..', '..Y..', '..y..', '..y..'],
]

// A thick question mark for the suit box, two pixels wide so it survives a soft CRT.
const QUESTION_ROWS: readonly string[] = [
  '.WWWW.',
  'WW..WW',
  '....WW',
  '...WW.',
  '..WW..',
  '..WW..',
  '......',
  '..WW..',
  '..WW..',
]

// A missile flying left: red nose cone, white body with a red band, gray fins and nozzle.
const MISSILE_ROWS: readonly string[] = [
  '...........ff...',
  '..rWWWWWWWWWff..',
  '.rrWWWWWkWWWWgg.',
  'rrrWWWWWkWWWWgg.',
  '.rrWWWWWkWWWWgg.',
  '..rWWWWWWWWWff..',
  '...........ff...',
]

let cache: {
  hero: Record<'runA' | 'runB' | 'fly', HTMLCanvasElement>
  flip: Record<'runA' | 'runB' | 'fly', HTMLCanvasElement>
  rig: HTMLCanvasElement[]
  dragon: HTMLCanvasElement[]
  hog: HTMLCanvasElement
  keyframe: HTMLCanvasElement[]
  missile: HTMLCanvasElement
  question: HTMLCanvasElement
} | null = null

function heroFrames(
  palette: Record<string, string>,
): Record<'runA' | 'runB' | 'fly', HTMLCanvasElement> {
  return {
    runA: outlined([...HERO_TOP, ...HERO_LEGS.runA], palette),
    runB: outlined([...HERO_TOP, ...HERO_LEGS.runB], palette),
    fly: outlined([...HERO_TOP, ...HERO_LEGS.fly], palette),
  }
}

/** Sprites are built on first use, once the page has a canvas to draw into. */
function sprites(): NonNullable<typeof cache> {
  cache ??= {
    hero: heroFrames(HERO_PALETTE),
    flip: heroFrames(FLIP_PALETTE),
    rig: RIG_ROWS.map((rows) => outlined(rows, RIG_PALETTE)),
    dragon: DRAGON_ROWS.map((rows) => outlined(rows, DRAGON_PALETTE)),
    hog: outlined(HOG_ROWS, HOG_PALETTE),
    keyframe: KEYFRAME_ROWS.map((rows) => outlined(rows, { y: '#b8860b', Y: '#ffd21a' })),
    question: outlined(QUESTION_ROWS, { W: '#ffffff' }),
    missile: outlined(MISSILE_ROWS, {
      r: '#e02424',
      W: '#eef0f6',
      k: '#e02424',
      f: '#8e93a2',
      g: '#4b5063',
    }),
  }
  return cache
}

/** Each suit's collision box, relative to the sprite's top-left corner, and its sprite size. */
export const SUIT_SIZES: Record<
  Suit,
  { width: number; height: number; box: [number, number, number, number] }
> = {
  // Boxes are [left, top, right, bottom], a little inside the art so hits feel fair.
  jetpack: { width: 13, height: 18, box: [3, 2, 10, 16] },
  flip: { width: 13, height: 18, box: [3, 2, 10, 16] },
  jumpCut: { width: 13, height: 18, box: [3, 2, 10, 16] },
  rig: { width: 18, height: 16, box: [3, 2, 15, 15] },
  dragon: { width: 24, height: 13, box: [3, 2, 21, 11] },
  hog: { width: 22, height: 12, box: [2, 1, 19, 11] },
}

export interface PlayerPose {
  suit: Suit
  x: number
  y: number
  ticks: number
  grounded: boolean
  thrusting: boolean
  /** True when the Flip Suit is running on the ceiling. */
  upsideDown: boolean
  /** True after a crash, while the editor tumbles. */
  crashed: boolean
}

function blitFlipped(
  context: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  x: number,
  y: number,
): void {
  context.save()
  context.translate(Math.round(x), Math.round(y) + image.height)
  context.scale(1, -1)
  context.drawImage(image, 0, 0)
  context.restore()
}

function drawFlame(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  ticks: number,
  big: boolean,
): void {
  const length: number = (big ? 6 : 3) + (ticks % 3)
  rect(context, x - 1, y, 3, length, '#ff6319')
  rect(context, x, y, 1, length - 1, '#ffd21a')
  if (ticks % 2 === 0) rect(context, x, y + length, 1, 2, '#ff3030')
}

/** Draws the player in whatever suit they are wearing, top-left at (x, y). */
export function drawPlayer(context: CanvasRenderingContext2D, pose: PlayerPose): void {
  const art = sprites()
  const { x, y, ticks } = pose
  const stride: 'runA' | 'runB' = Math.floor(ticks / 6) % 2 === 0 ? 'runA' : 'runB'
  switch (pose.suit) {
    case 'jetpack':
    case 'jumpCut': {
      const frame: HTMLCanvasElement =
        pose.crashed || !pose.grounded ? art.hero.fly : art.hero[stride]
      if (pose.crashed) {
        blitFlipped(context, frame, x, y)
        return
      }
      context.drawImage(frame, Math.round(x), Math.round(y))
      // Flame from the jetpack nozzle while thrusting, a flicker while gliding.
      if (pose.suit === 'jetpack' && !pose.grounded) {
        drawFlame(context, x + 2, y + 13, ticks, pose.thrusting)
      }
      if (pose.suit === 'jumpCut') {
        // Editing brackets around the editor, like a selected clip.
        const color: string = Math.floor(ticks / 6) % 2 === 0 ? '#ff4fd8' : '#c026d3'
        rect(context, x - 3, y - 2, 2, 22, color)
        rect(context, x - 3, y - 2, 5, 2, color)
        rect(context, x - 3, y + 18, 5, 2, color)
        rect(context, x + 14, y - 2, 2, 22, color)
        rect(context, x + 11, y - 2, 5, 2, color)
        rect(context, x + 11, y + 18, 5, 2, color)
      }
      return
    }
    case 'flip': {
      const frame: HTMLCanvasElement = pose.grounded ? art.flip[stride] : art.flip.fly
      if (pose.upsideDown) blitFlipped(context, frame, x, y)
      else context.drawImage(frame, Math.round(x), Math.round(y))
      return
    }
    case 'rig': {
      const frame: HTMLCanvasElement = pose.grounded
        ? (art.rig[Math.floor(ticks / 8) % 2] ?? art.rig[0]!)
        : art.rig[0]!
      context.drawImage(frame, Math.round(x), Math.round(y))
      // Hand thrusters fire while it hovers.
      if (!pose.grounded && pose.thrusting) {
        drawFlame(context, x + 2, y + 11, ticks, false)
        drawFlame(context, x + 15, y + 11, ticks, false)
      }
      return
    }
    case 'dragon': {
      const frame: HTMLCanvasElement = art.dragon[Math.floor(ticks / 10) % 2] ?? art.dragon[0]!
      context.drawImage(frame, Math.round(x), Math.round(y))
      // Breathes fire while diving.
      if (pose.thrusting) {
        const reach: number = 8 + (ticks % 4)
        for (let step: number = 0; step < reach; step += 1) {
          const spread: number = Math.floor(step / 3)
          rect(
            context,
            x + 23 + step,
            y + 4 - spread / 2,
            1,
            1 + spread,
            step % 2 ? '#ffd21a' : '#ff6319',
          )
        }
      }
      return
    }
    case 'hog': {
      context.drawImage(art.hog, Math.round(x), Math.round(y))
      return
    }
  }
}

/** A keyframe, the collectible: a gold diamond that spins. */
export function drawKeyframe(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  ticks: number,
  seed: number,
): void {
  const frames: HTMLCanvasElement[] = sprites().keyframe
  // Mostly the full diamond, with a quick spin now and then, so it always reads as a keyframe.
  const phase: number = (Math.floor(ticks / 5) + seed) % 12
  const frame: HTMLCanvasElement =
    frames[phase === 9 || phase === 11 ? 1 : phase === 10 ? 2 : 0] ?? frames[0]!
  context.drawImage(frame, Math.round(x - frame.width / 2), Math.round(y - frame.height / 2))
}

/**
 * A play token: a gold coin stamped with the Aspect logo, worth one pull on the slot machine.
 * A glint sweeps across it. Small tokens (for the score bar) leave the logo off.
 */
export function drawToken(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  ticks: number,
  radius: number = 9,
): void {
  const cx: number = Math.round(x)
  const cy: number = Math.round(y)
  ellipse(context, cx, cy, radius + 1, radius + 1, '#000000')
  ellipse(context, cx, cy, radius, radius, '#b8860b')
  ellipse(context, cx, cy, radius - 1, radius - 1, '#ffd21a')
  if (radius < 6) {
    rect(context, cx - 1, cy - 1, 2, 2, '#b8860b')
    return
  }
  ellipse(context, cx, cy, radius - 2, radius - 2, '#e8a317')
  // The logo is embossed: a dark shadow with the raised mark in light gold on top.
  // The logo sits well inside the rim, with a clear gold margin all around it.
  const logoWidth: number = radius * 2 - 9
  const logoHeight: number = Math.round(logoWidth * 0.83)
  const logoX: number = cx - Math.floor(logoWidth / 2)
  const logoY: number = cy - Math.floor(logoHeight / 2)
  context.drawImage(logo(logoWidth, logoHeight, '#7c4a03'), logoX + 1, logoY + 1)
  context.drawImage(logo(logoWidth, logoHeight, '#fff0a8'), logoX, logoY)
  // A glint that crosses the coin every couple of seconds.
  const sweep: number = (ticks % 90) - 20
  if (sweep >= -radius && sweep <= radius) {
    for (let dy: number = -radius + 2; dy <= radius - 2; dy += 1) {
      const dx: number = sweep - dy
      if (dx * dx + dy * dy < (radius - 1) * (radius - 1)) {
        rect(context, cx + dx, cy + dy, 2, 1, 'rgb(255 255 255 / 80%)')
      }
    }
  }
}

/**
 * The ? box that holds a suit. Its color cycles through the rainbow, and a shine sweeps across it
 * from the top-left corner to the bottom-right.
 */
export function drawSuitBox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  ticks: number,
): void {
  const size: number = 13
  const left: number = Math.round(x - size / 2)
  const top: number = Math.round(y - size / 2)
  const hue: number = (ticks * 4) % 360
  rect(context, left - 1, top - 1, size + 2, size + 2, '#000000')
  rect(context, left, top, size, size, `hsl(${hue} 75% 38%)`)
  rect(context, left + 1, top + 1, size - 2, size - 2, `hsl(${hue} 85% 58%)`)
  rect(context, left + 1, top + 1, size - 2, 1, `hsl(${hue} 90% 78%)`)
  // The shine: a bright diagonal band that slides from the top-left to the bottom-right.
  const band: number = (ticks % 50) - 6
  for (let row: number = 1; row < size - 1; row += 1) {
    for (let width: number = 0; width < 3; width += 1) {
      const col: number = band + width - row
      if (col >= 1 && col < size - 1) {
        rect(
          context,
          left + col,
          top + row,
          1,
          1,
          width === 1 ? '#ffffff' : 'rgb(255 255 255 / 55%)',
        )
      }
    }
  }
  // A chunky outlined ? that stays crisp under the shine.
  context.drawImage(sprites().question, left + 3, top + 1)
}

/** A missile flying left, its exhaust flame flickering out the back. */
export function drawMissile(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  ticks: number,
): void {
  const missile: HTMLCanvasElement = sprites().missile
  const top: number = Math.round(y - missile.height / 2)
  const tail: number = Math.round(x) + missile.width - 2
  const flame: number = 5 + (ticks % 3) * 2
  rect(context, tail, top + 3, flame, 3, '#ff6319')
  rect(context, tail, top + 4, flame - 2, 1, '#ffd21a')
  if (ticks % 2 === 0) rect(context, tail + flame, top + 4, 2, 1, '#ff3030')
  // Smoke puffs trailing behind.
  for (let puff: number = 0; puff < 3; puff += 1) {
    rect(
      context,
      tail + flame + 3 + puff * 5,
      top + 3 + ((ticks + puff) % 2),
      3,
      3,
      'rgb(200 205 220 / 45%)',
    )
  }
  context.drawImage(missile, Math.round(x), top)
}

/**
 * The warning at the right edge before a missile fires: a red ! box. The caller decides whether
 * it is lit this frame, so it can flash faster and faster.
 */
export function drawMissileWarning(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  lit: boolean,
): void {
  rect(context, x - 1, y - 7, 12, 15, '#000000')
  rect(context, x, y - 6, 10, 13, lit ? '#ff3030' : '#5a0d0d')
  text(context, '!', x + 3, y - 3, lit ? INK : '#c98a8a', { shadow: false })
}

/** A live wire, the zapper: a sparking cable between two connectors. */
export function drawWire(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  ticks: number,
  seed: number,
): void {
  const length: number = Math.hypot(x2 - x1, y2 - y1)
  const steps: number = Math.max(1, Math.round(length))
  const nx: number = -(y2 - y1) / (length || 1)
  const ny: number = (x2 - x1) / (length || 1)
  // A dark halo first, so the bright core reads against any room.
  for (let step: number = 0; step <= steps; step += 1) {
    const t: number = step / steps
    rect(context, x1 + (x2 - x1) * t - 2, y1 + (y2 - y1) * t - 2, 4, 4, '#000000')
  }
  for (let step: number = 0; step <= steps; step += 1) {
    const t: number = step / steps
    const jitter: number = ((step * 7 + seed + Math.floor(ticks / 2)) % 5) - 2
    const wobble: number = Math.abs(jitter) > 1 ? Math.sign(jitter) : 0
    // Red, so the wires never blend with the gold keyframes and tokens.
    const color: string = (step + Math.floor(ticks / 3)) % 6 < 3 ? '#ff2a2a' : '#ff9a9a'
    rect(
      context,
      x1 + (x2 - x1) * t + nx * wobble - 1,
      y1 + (y2 - y1) * t + ny * wobble - 1,
      2,
      2,
      color,
    )
  }
  for (const [x, y] of [
    [x1, y1],
    [x2, y2],
  ] as const) {
    rect(context, x - 4, y - 4, 8, 8, '#000000')
    rect(context, x - 3, y - 3, 6, 6, '#9aa0b4')
    rect(context, x - 1, y - 1, 2, 2, Math.floor(ticks / 6) % 2 ? '#ff2a2a' : '#ff9a9a')
  }
}

/** A projector beam across the room: a thin flicker while warming up, then a thick hot beam. */
export function drawLaser(
  context: CanvasRenderingContext2D,
  width: number,
  y: number,
  ticks: number,
  firing: boolean,
): void {
  for (const x of [0, width - 7]) {
    rect(context, x, y - 5, 7, 10, '#000000')
    rect(context, x + 1, y - 4, 5, 8, '#4b5063')
    rect(
      context,
      x + (x === 0 ? 5 : 0),
      y - 2,
      2,
      4,
      firing || ticks % 10 < 5 ? '#ff3030' : '#7f1d1d',
    )
  }
  if (firing) {
    const wobble: number = ticks % 2
    rect(context, 7, y - 3 - wobble, width - 14, 6 + wobble * 2, 'rgb(255 48 48 / 55%)')
    rect(context, 7, y - 2, width - 14, 4, '#ff3030')
    rect(context, 7, y - 1, width - 14, 2, '#ffe4e4')
  } else if (ticks % 6 < 4) {
    for (let x: number = 9; x < width - 9; x += 6) rect(context, x, y, 3, 1, '#ff3030')
  }
}

// Rooms of the post house. Each scrolls its own props behind the action, kept dark so the
// obstacles and keyframes stay the brightest things on screen.

export interface Room {
  name: string
  wall: string
  /** Seams between wall panels, a step darker than the wall. */
  seam: string
  floor: string
  trim: string
  props(
    context: CanvasRenderingContext2D,
    width: number,
    top: number,
    floor: number,
    scroll: number,
    ticks: number,
  ): void
}

const parallax = (scroll: number, factor: number, spacing: number): number =>
  -((scroll * factor) % spacing)

// The rooms are mid-tone, like a lit facility, but never as bright as the hazards, which all
// carry black outlines and hot colors on top.
export const ROOMS: readonly Room[] = [
  {
    name: 'EDIT BAY',
    wall: '#3a4a86',
    seam: '#2c3a6e',
    floor: '#59618a',
    trim: '#8a96d0',
    props(context, width, _top, floor, scroll, ticks) {
      // Desks with two monitors showing a timeline.
      for (let x: number = parallax(scroll, 0.5, 90); x < width; x += 90) {
        const deskTop: number = floor - 14
        rect(context, x + 10, deskTop, 60, 3, '#5c6aa8')
        rect(context, x + 14, deskTop + 3, 3, 11, '#46538c')
        rect(context, x + 63, deskTop + 3, 3, 11, '#46538c')
        for (const offset of [14, 42]) {
          rect(context, x + offset, deskTop - 20, 24, 16, '#1b2140')
          rect(context, x + offset + 1, deskTop - 19, 22, 14, '#24305e')
          const playhead: number = (ticks / 4 + offset) % 20
          rect(context, x + offset + 2, deskTop - 14, 8, 2, '#4f7be0')
          rect(context, x + offset + 11, deskTop - 14, 9, 2, '#3fbf6a')
          rect(context, x + offset + 4, deskTop - 10, 12, 2, '#e08a3f')
          rect(context, x + offset + 2 + playhead, deskTop - 18, 1, 12, '#ff5a5a')
        }
      }
    },
  },
  {
    name: 'COLOR SUITE',
    wall: '#5c5c66',
    seam: '#4a4a53',
    floor: '#6e6e7a',
    trim: '#9a9aa8',
    props(context, width, top, _floor, scroll) {
      // A grading panel's three color wheels on big monitors.
      for (let x: number = parallax(scroll, 0.5, 110); x < width; x += 110) {
        rect(context, x + 10, top + 20, 70, 40, '#26262c')
        rect(context, x + 12, top + 22, 66, 36, '#34343c')
        ;['#c0504d', '#4fae5b', '#4f72c0'].forEach((color: string, index: number): void => {
          ellipse(context, x + 24 + index * 21, top + 40, 8, 8, '#1f1f24')
          ellipse(context, x + 24 + index * 21, top + 40, 6, 6, color)
          rect(context, x + 24 + index * 21, top + 37, 1, 1, '#f2f2f2')
        })
      }
    },
  },
  {
    name: 'MIX STAGE',
    wall: '#55407e',
    seam: '#443266',
    floor: '#6a5694',
    trim: '#9a84c8',
    props(context, width, top, floor, scroll, ticks) {
      // Acoustic panels on the wall, and a long mixing console with bouncing meters.
      for (let x: number = parallax(scroll, 0.35, 28); x < width; x += 28) {
        rect(context, x + 4, top + 8, 20, 30, '#47346a')
        rect(context, x + 6, top + 10, 16, 26, '#3e2d5e')
      }
      for (let x: number = parallax(scroll, 0.5, 64); x < width; x += 64) {
        rect(context, x, floor - 12, 62, 12, '#2e2244')
        for (let fader: number = 0; fader < 8; fader += 1) {
          const level: number = 2 + ((fader * 5 + Math.floor(ticks / 7)) % 7)
          rect(context, x + 4 + fader * 7, floor - 10, 2, 8, '#1b1430')
          rect(
            context,
            x + 4 + fader * 7,
            floor - 3 - level,
            2,
            1,
            level > 6 ? '#ff5a5a' : '#3fbf6a',
          )
        }
      }
    },
  },
  {
    name: 'RENDER FARM',
    wall: '#2f5560',
    seam: '#24444d',
    floor: '#46707c',
    trim: '#72a6b4',
    props(context, width, top, floor, scroll, ticks) {
      // Rows of server racks with blinking lights.
      for (let x: number = parallax(scroll, 0.5, 34); x < width; x += 34) {
        rect(context, x + 4, top + 6, 26, floor - top - 6, '#1d343b')
        for (let slot: number = top + 10; slot < floor - 4; slot += 6) {
          rect(context, x + 6, slot, 22, 4, '#152a30')
          const blink: boolean = (slot + Math.floor(ticks / 9) + x) % 5 === 0
          rect(context, x + 8, slot + 1, 1, 1, blink ? '#5cff8f' : '#2f7a4a')
          rect(context, x + 11, slot + 1, 1, 1, (slot + x) % 3 === 0 ? '#ffb020' : '#2f7a4a')
        }
      }
    },
  },
  {
    name: 'VFX LAB',
    wall: '#2f8a4a',
    seam: '#26713c',
    floor: '#4a6656',
    trim: '#7ccf94',
    props(context, width, top, floor, scroll) {
      // A green screen wall with tracking markers.
      for (let x: number = parallax(scroll, 0.4, 36); x < width; x += 36) {
        for (let y: number = top + 14; y < floor - 8; y += 30) {
          rect(context, x + 16, y, 1, 7, '#c9f5d6')
          rect(context, x + 13, y + 3, 7, 1, '#c9f5d6')
        }
      }
    },
  },
]

/** The room: paneled walls, its props, ceiling lights, and a tiled floor. */
export function drawRoom(
  context: CanvasRenderingContext2D,
  room: Room,
  width: number,
  top: number,
  floor: number,
  bottom: number,
  scroll: number,
  ticks: number,
): void {
  rect(context, 0, top, width, floor - top, room.wall)
  // Wall panels: seams every so often and a rail across the middle, for depth.
  for (let x: number = parallax(scroll, 0.5, 60); x < width; x += 60) {
    rect(context, x, top, 2, floor - top, room.seam)
  }
  rect(context, 0, Math.round((top + floor) / 2), width, 2, room.seam)
  room.props(context, width, top, floor, scroll, ticks)
  rect(context, 0, top, width, 4, room.trim)
  rect(context, 0, top + 4, width, 1, room.seam)
  for (let x: number = parallax(scroll, 1, 48); x < width; x += 48)
    rect(context, x + 18, top + 4, 12, 2, '#fff7d6')
  rect(context, 0, floor, width, bottom - floor, room.floor)
  rect(context, 0, floor, width, 2, room.trim)
  for (let x: number = parallax(scroll, 1, 24); x < width; x += 24)
    rect(context, x, floor + 2, 1, bottom - floor - 2, room.seam)
}

/** The door sign shown when the run moves into a new room. */
export function drawRoomSign(
  context: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
): void {
  const width: number = textWidth(name) + 12
  rect(context, x - width / 2 - 1, y - 1, width + 2, 13, '#000000')
  rect(context, x - width / 2, y, width, 11, '#f2f2f2')
  text(context, name, x, y + 2, '#15161c', { align: 'center', shadow: false })
}

// The slot machine's prizes, as icons for its reels.
export type SlotSymbol = 'take2' | 'suit' | 'bonus' | 'spins'

export const SLOT_SYMBOLS: readonly SlotSymbol[] = ['take2', 'suit', 'bonus', 'spins']

/** Draws one reel symbol centered on (x, y), about 16 pixels across. */
export function drawSlotSymbol(
  context: CanvasRenderingContext2D,
  symbol: SlotSymbol,
  x: number,
  y: number,
  ticks: number,
): void {
  const cx: number = Math.round(x)
  const cy: number = Math.round(y)
  switch (symbol) {
    case 'take2': {
      // A clapperboard: take 2.
      rect(context, cx - 8, cy - 7, 16, 15, '#000000')
      rect(context, cx - 7, cy - 6, 14, 4, '#f2f2f2')
      for (let stripe: number = 0; stripe < 3; stripe += 1)
        rect(context, cx - 6 + stripe * 5, cy - 6, 2, 4, '#15161c')
      rect(context, cx - 7, cy - 1, 14, 8, '#2b2d36')
      text(context, '2', cx, cy, '#ffd21a', { align: 'center', shadow: false })
      return
    }
    case 'suit': {
      drawSuitBox(context, cx, cy, ticks)
      return
    }
    case 'bonus': {
      const art = sprites().keyframe[0]!
      context.drawImage(art, cx - art.width, cy - art.height, art.width * 2, art.height * 2)
      return
    }
    case 'spins': {
      drawToken(context, cx, cy, ticks, 7)
      return
    }
  }
}
