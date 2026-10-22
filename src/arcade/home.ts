import type { Corner } from '../lib/booth'
import { BOUNCE_COLORS } from '../lib/bounce'
import { BRAND, INK, NIGHT, draw, logo, rect, seeded, stage, text, textWidth } from './pixel'

// The corner-logo home screen: the Aspect mark as a "channel bug" in one corner over a scrolling neon grid,
// so the screen stays lively for passersby without the big logo bouncing through everything.

/** Height of the scrolling tapes along the top and bottom of the home screen. */
export const TAPE_HEIGHT: number = 11

const LOGO_WIDTH: number = 30
const LOGO_HEIGHT: number = 25
/** Frames each logo color lasts, matching the bounce palette's rhythm. */
const COLOR_FRAMES: number = 180

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

function color(frame: number, offset: number = 0): string {
  return BOUNCE_COLORS[(Math.floor(frame / COLOR_FRAMES) + offset) % BOUNCE_COLORS.length] ?? BRAND
}

/** Where the corner logo sits and how big it is, so the home screen can lay out around it. */
export function brandBox(corner: Corner): Box {
  const width: number = LOGO_WIDTH
  const height: number = LOGO_HEIGHT
  const margin: number = 6
  return {
    x: corner.endsWith('left') ? margin : stage.width - margin - width,
    // The logo sits just inside the tapes.
    y: corner.startsWith('top')
      ? TAPE_HEIGHT + margin
      : stage.height - TAPE_HEIGHT - margin - height,
    width,
    height,
  }
}

export function drawBrand(context: CanvasRenderingContext2D, frame: number, box: Box): void {
  const tint: string = color(frame)
  draw(context, logo(LOGO_WIDTH, LOGO_HEIGHT, tint), box.x, box.y)
  // Every few seconds a glint sweeps across the mark.
  const sweep: number = (frame % 300) - 40
  if (sweep >= 0 && sweep < LOGO_WIDTH + 6) {
    context.save()
    context.beginPath()
    context.rect(box.x + sweep - 3, box.y, 3, LOGO_HEIGHT)
    context.clip()
    draw(context, logo(LOGO_WIDTH, LOGO_HEIGHT, INK), box.x, box.y)
    context.restore()
  }
}

const stars: { x: number; y: number; phase: number }[] = (() => {
  const random: () => number = seeded(11)
  return Array.from({ length: 70 }, () => ({ x: random(), y: random(), phase: random() * 200 }))
})()

/** A synthwave sky and a grid floor that scrolls toward the viewer, in Aspect's colors. */
export function drawNeonScene(context: CanvasRenderingContext2D, frame: number): void {
  const width: number = stage.width
  const height: number = stage.height
  const horizon: number = Math.round(height * 0.56)
  const centerX: number = width / 2
  rect(context, 0, 0, width, height, NIGHT)

  // Sky: twinkling stars, brighter toward the top.
  for (const star of stars) {
    const y: number = Math.floor(star.y * (horizon - 4))
    const twinkle: number = (frame + star.phase) % 200
    const bright: boolean = twinkle < 8
    rect(context, Math.floor(star.x * width), y, 1, 1, bright ? INK : '#363b52')
  }
  // Now and then a shooting star crosses the sky.
  const streak: number = frame % 420
  if (streak < 36) {
    const seed: number = Math.floor(frame / 420)
    const startX: number = (((seed * 97) % 60) / 100) * width + width * 0.2
    const startY: number = 6 + ((seed * 31) % 30)
    for (let tail: number = 0; tail < 10; tail += 1) {
      const x: number = startX + (streak - tail) * 3
      const y: number = startY + (streak - tail) * 1
      rect(context, x, y, 1, 1, tail === 0 ? INK : tail < 4 ? '#a9b7ff' : '#3f57d7')
    }
  }

  // Horizon glow in the current logo color.
  const glow: string = color(frame)
  for (let band: number = 0; band < 6; band += 1) {
    context.globalAlpha = 0.05 * (6 - band)
    rect(context, 0, horizon - band * 3, width, 3, glow)
  }
  context.globalAlpha = 1
  rect(context, 0, horizon, width, 1, glow)

  // Floor: horizontal lines speed up as they approach, vertical lines meet at the horizon.
  const floor: number = height - horizon
  context.fillStyle = '#0b0d16'
  context.fillRect(0, horizon + 1, width, floor)
  const lines: number = 9
  const phase: number = (frame % 90) / 90
  for (let index: number = 0; index < lines; index += 1) {
    const depth: number = (index + phase) / lines
    const y: number = horizon + 1 + Math.round(depth ** 2.2 * floor)
    context.globalAlpha = 0.25 + depth * 0.6
    rect(context, 0, y, width, 1, '#ec4899')
  }
  const spread: number = width * 0.09
  for (let column: number = -12; column <= 12; column += 1) {
    const bottomX: number = centerX + column * spread
    for (let y: number = horizon + 1; y < height; y += 1) {
      const t: number = (y - horizon) / floor
      context.globalAlpha = 0.2 + t * 0.55
      rect(context, centerX + (bottomX - centerX) * t, y, 1, 1, '#3f57d7')
    }
  }
  context.globalAlpha = 1
}

/**
 * A thin band of repeating text that scrolls sideways, like marquee tape. Direction 1 scrolls
 * left, -1 scrolls right.
 */
export function drawTape(
  context: CanvasRenderingContext2D,
  frame: number,
  y: number,
  message: string,
  background: string,
  ink: string,
  direction: 1 | -1,
): void {
  const width: number = stage.width
  rect(context, 0, y, width, TAPE_HEIGHT, background)
  rect(context, 0, y, width, 1, 'rgb(0 0 0 / 35%)')
  rect(context, 0, y + TAPE_HEIGHT - 1, width, 1, 'rgb(0 0 0 / 35%)')
  const unit: string = `${message}   ■   `
  const unitWidth: number = textWidth(unit) + 6
  const offset: number = (((frame * 0.5 * direction) % unitWidth) + unitWidth) % unitWidth
  for (let x: number = -offset; x < width; x += unitWidth) {
    text(context, unit, x, y + 2, ink, { shadow: false })
  }
}
