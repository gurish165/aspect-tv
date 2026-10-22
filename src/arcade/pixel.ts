// Pixel drawing helpers. Everything is drawn on a small canvas that CSS scales up with hard edges.

/** Arcade pixels at the default size, which fit the locked booth window. */
export const BASE_WIDTH: number = 312
export const BASE_HEIGHT: number = 178

/**
 * The arcade's current size in its own pixels. It follows the window, the size setting, and the
 * horizontal stretch, so layouts read it every frame instead of assuming a fixed screen.
 */
export const stage: { width: number; height: number } = { width: BASE_WIDTH, height: BASE_HEIGHT }

export const INK: string = '#f2f3f8'
export const MUTED: string = '#8e93a2'
export const DIM: string = '#4a4f63'
export const NIGHT: string = '#07080b'
export const PANEL: string = '#10131d'
export const EDGE: string = '#2a2f45'
export const BRAND: string = '#798cf2'
export const BRAND_DEEP: string = '#3f57d7'
export const GOLD: string = '#eab308'
export const DANGER: string = '#ef4444'

// 5x7 glyphs, rows separated by spaces.
const GLYPHS: Record<string, string> = {
  A: '.###. #...# #...# ##### #...# #...# #...#',
  B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####',
  F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .####',
  H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  J: '..### ...#. ...#. ...#. ...#. #..#. .##..',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
  L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  N: '#...# #...# ##..# #.#.# #..## #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#',
  R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.',
  X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  Z: '##### ....# ...#. ..#.. .#... #.... #####',
  '0': '.###. #...# #..## #.#.# ##..# #...# .###.',
  '1': '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  '2': '.###. #...# ....# ...#. ..#.. .#... #####',
  '3': '####. ....# ....# .###. ....# ....# ####.',
  '4': '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
  '5': '##### #.... ####. ....# ....# #...# .###.',
  '6': '..##. .#... #.... ####. #...# #...# .###.',
  '7': '##### ....# ...#. ..#.. .#... .#... .#...',
  '8': '.###. #...# #...# .###. #...# #...# .###.',
  '9': '.###. #...# #...# .#### ....# ...#. .##..',
  ' ': '..... ..... ..... ..... ..... ..... .....',
  '.': '..... ..... ..... ..... ..... .##.. .##..',
  ',': '..... ..... ..... ..... .##.. ..#.. .#...',
  '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..',
  '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
  ':': '..... .##.. .##.. ..... .##.. .##.. .....',
  '-': '..... ..... ..... .###. ..... ..... .....',
  '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
  '/': '....# ....# ...#. ..#.. .#... #.... #....',
  '*': '..... #.#.# .###. ##### .###. #.#.# .....',
  '#': '.#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.',
  "'": '..#.. ..#.. .#... ..... ..... ..... .....',
  '(': '...#. ..#.. .#... .#... .#... ..#.. ...#.',
  ')': '.#... ..#.. ...#. ...#. ...#. ..#.. .#...',
  '<': '...#. ..#.. .#... #.... .#... ..#.. ...#.',
  '>': '.#... ..#.. ...#. ....# ...#. ..#.. .#...',
  '=': '..... ..... ##### ..... ##### ..... .....',
  _: '..... ..... ..... ..... ..... ..... #####',
  '%': '##..# ##..# ...#. ..#.. .#... #..## #..##',
  ';': '..... .##.. .##.. ..... .##.. ..#.. .#...',
  '"': '.#.#. .#.#. .#.#. ..... ..... ..... .....',
  '&': '.##.. #..#. #.#.. .#... #.#.# #..#. .##.#',
  '@': '.###. #...# #.### #.#.# #.### #.... .####',
  $: '..#.. .#### #.#.. .###. ..#.# ####. ..#..',
  '·': '..... ..... ..... ..#.. ..... ..... .....',
  '↑': '..#.. .###. #.#.# ..#.. ..#.. ..#.. ..#..',
  '↓': '..#.. ..#.. ..#.. ..#.. #.#.# .###. ..#..',
  '←': '..... ..#.. .#... ##### .#... ..#.. .....',
  '→': '..... ..#.. ...#. ##### ...#. ..#.. .....',
  '▲': '..... ..#.. .###. ##### ..... ..... .....',
  '▼': '..... ..... ##### .###. ..#.. ..... .....',
  '◀': '...#. ..##. .###. ..##. ...#. ..... .....',
  '▶': '.#... .##.. .###. .##.. .#... ..... .....',
  '■': '..... ##### ##### ##### ##### ##### .....',
  '□': '..... ##### #...# #...# #...# ##### .....',
}

const GLYPH_WIDTH: number = 5
const GLYPH_HEIGHT: number = 7
const glyphCanvases: Map<string, HTMLCanvasElement> = new Map()

function glyph(character: string, color: string): HTMLCanvasElement {
  const key: string = `${character}${color}`
  const cached: HTMLCanvasElement | undefined = glyphCanvases.get(key)
  if (cached) return cached
  const rows: string[] = (GLYPHS[character] ?? GLYPHS['?'] ?? '').split(' ')
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = GLYPH_WIDTH
  canvas.height = GLYPH_HEIGHT
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context) {
    context.fillStyle = color
    rows.forEach((row: string, y: number): void => {
      for (let x: number = 0; x < row.length; x += 1) {
        if (row[x] === '#') context.fillRect(x, y, 1, 1)
      }
    })
  }
  glyphCanvases.set(key, canvas)
  return canvas
}

/** A character's rows in the pixel font, '#' for a lit pixel. */
export function glyphRows(character: string): string[] {
  return (GLYPHS[character] ?? GLYPHS['?'] ?? '').split(' ')
}

export type Align = 'left' | 'center' | 'right'

export interface TextOptions {
  scale?: number
  align?: Align
  shadow?: string | false
  /** Steps the scale down until the text fits this width. */
  maxWidth?: number
}

export function textWidth(text: string, scale: number = 1): number {
  return text.length === 0 ? 0 : (text.length * (GLYPH_WIDTH + 1) - 1) * scale
}

export function text(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  color: string,
  { scale: requestedScale = 1, align = 'left', shadow = '#000000', maxWidth }: TextOptions = {},
): void {
  const characters: string = value.toUpperCase()
  const scale: number = fittedScale(characters, requestedScale, maxWidth)
  const width: number = textWidth(characters, scale)
  const left: number = Math.round(
    align === 'center' ? x - width / 2 : align === 'right' ? x - width : x,
  )
  const draw = (offset: number, ink: string): void => {
    for (let index: number = 0; index < characters.length; index += 1) {
      const character: string = characters[index] ?? ' '
      if (character === ' ') continue
      context.drawImage(
        glyph(character, ink),
        left + index * (GLYPH_WIDTH + 1) * scale + offset,
        Math.round(y) + offset,
        GLYPH_WIDTH * scale,
        GLYPH_HEIGHT * scale,
      )
    }
  }
  if (shadow) draw(scale, shadow)
  draw(0, color)
}

export function fittedScale(value: string, scale: number, maxWidth?: number): number {
  let fitted: number = scale
  while (maxWidth !== undefined && fitted > 1 && textWidth(value, fitted) > maxWidth) fitted -= 1
  return fitted
}

/**
 * Spreads blocks of the given heights down the space between top and bottom, with even gaps no
 * bigger than maxGap, and returns each block's top. Extra room goes above and below.
 */
export function column(
  heights: readonly number[],
  top: number,
  bottom: number,
  maxGap: number = 14,
): number[] {
  const total: number = heights.reduce((sum: number, height: number): number => sum + height, 0)
  const gaps: number = Math.max(1, heights.length - 1)
  const gap: number = Math.max(2, Math.min(maxGap, (bottom - top - total) / gaps))
  let y: number = top + Math.max(0, (bottom - top - total - gap * (heights.length - 1)) / 2)
  return heights.map((height: number): number => {
    const position: number = Math.round(y)
    y += height + gap
    return position
  })
}

export function rect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  context.fillStyle = color
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height))
}

export function outline(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  thickness: number = 1,
): void {
  rect(context, x, y, width, thickness, color)
  rect(context, x, y + height - thickness, width, thickness, color)
  rect(context, x, y, thickness, height, color)
  rect(context, x + width - thickness, y, thickness, height, color)
}

export function ellipse(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  color: string,
): void {
  context.fillStyle = color
  for (let dy: number = -radiusY; dy <= radiusY; dy += 1) {
    const span: number = Math.round(radiusX * Math.sqrt(1 - (dy / (radiusY + 0.5)) ** 2))
    context.fillRect(centerX - span, centerY + dy, span * 2 + 1, 1)
  }
}

export function blink(frame: number, period: number = 40): boolean {
  return frame % period < period / 2
}

/** The game clock turns gold, then red, as time runs out. */
export function clockColor(secondsLeft: number): string {
  return secondsLeft <= 5 ? DANGER : secondsLeft <= 15 ? GOLD : INK
}

export function pad(value: number, length: number = 5): string {
  return String(Math.max(0, Math.floor(value))).padStart(length, '0')
}

// Builds a sprite from rows of palette keys. '.' is transparent.
export function sprite(
  rows: readonly string[],
  palette: Record<string, string>,
): HTMLCanvasElement {
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = Math.max(...rows.map((row: string): number => row.length))
  canvas.height = rows.length
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (!context) return canvas
  rows.forEach((row: string, y: number): void => {
    for (let x: number = 0; x < row.length; x += 1) {
      const color: string | undefined = palette[row[x] ?? '.']
      if (!color) continue
      context.fillStyle = color
      context.fillRect(x, y, 1, 1)
    }
  })
  return canvas
}

// The real Aspect logo paths, rasterized to hard pixels at any size.
const LOGO_PATHS: readonly string[] = [
  'M34.4634 49.2292L6.34055 73.8992C6.1241 74.0891 6 74.3631 6 74.651V160C6 160.553 6.44771 161 7 161H160.183C160.736 161 161.183 160.553 161.183 160V120.075C161.183 119.523 160.736 119.075 160.183 119.075H37.1228C36.5706 119.075 36.1228 118.628 36.1228 118.075V49.9809C36.1228 49.1211 35.1097 48.6622 34.4634 49.2292Z',
  'M163.537 117.771L191.659 93.1008C191.876 92.9109 192 92.6369 192 92.349V6.9996C192 6.44732 191.552 5.9996 191 5.9996H37.8166C37.2643 5.9996 36.8166 6.44732 36.8166 6.9996V46.9246C36.8166 47.4769 37.2643 47.9246 37.8166 47.9246H160.877C161.429 47.9246 161.877 48.3723 161.877 48.9246V117.019C161.877 117.879 162.89 118.338 163.537 117.771Z',
]
const logoCanvases: Map<string, HTMLCanvasElement> = new Map()

export function logo(width: number, height: number, color: string): HTMLCanvasElement {
  const key: string = `${width}x${height}${color}`
  const cached: HTMLCanvasElement | undefined = logoCanvases.get(key)
  if (cached) return cached
  const source: HTMLCanvasElement = document.createElement('canvas')
  source.width = width
  source.height = height
  const sourceContext: CanvasRenderingContext2D | null = source.getContext('2d')
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (sourceContext && context) {
    sourceContext.scale(width / 186, height / 155)
    sourceContext.translate(-6, -6)
    for (const path of LOGO_PATHS) sourceContext.fill(new Path2D(path))
    const pixels: Uint8ClampedArray = sourceContext.getImageData(0, 0, width, height).data
    context.fillStyle = color
    for (let y: number = 0; y < height; y += 1) {
      for (let x: number = 0; x < width; x += 1) {
        if ((pixels[(y * width + x) * 4 + 3] ?? 0) >= 110) context.fillRect(x, y, 1, 1)
      }
    }
  }
  logoCanvases.set(key, canvas)
  return canvas
}

export function draw(
  context: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  x: number,
  y: number,
  scale: number = 1,
): void {
  context.drawImage(image, Math.round(x), Math.round(y), image.width * scale, image.height * scale)
}

// A small seeded generator so backgrounds look the same every run.
export function seeded(seed: number): () => number {
  let state: number = seed >>> 0
  return (): number => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** A sprite with a one-pixel black outline around every solid pixel. */
export function outlined(
  rows: readonly string[],
  palette: Record<string, string>,
): HTMLCanvasElement {
  const width: number = (rows[0]?.length ?? 0) + 2
  const height: number = rows.length + 2
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (!context) return canvas
  const solid = (x: number, y: number): boolean => {
    const cell: string | undefined = rows[y]?.[x]
    return cell !== undefined && palette[cell] !== undefined
  }
  context.fillStyle = '#000000'
  for (let y: number = -1; y <= rows.length; y += 1) {
    for (let x: number = -1; x < width - 1; x += 1) {
      if (solid(x, y)) continue
      let near: boolean = false
      for (let dy: number = -1; dy <= 1 && !near; dy += 1) {
        for (let dx: number = -1; dx <= 1; dx += 1) if (solid(x + dx, y + dy)) near = true
      }
      if (near) context.fillRect(x + 1, y + 1, 1, 1)
    }
  }
  rows.forEach((row: string, y: number): void => {
    for (let x: number = 0; x < row.length; x += 1) {
      const color: string | undefined = palette[row[x] ?? '.']
      if (!color) continue
      context.fillStyle = color
      context.fillRect(x + 1, y + 1, 1, 1)
    }
  })
  return canvas
}
