/**
 * Colour maths for generated compositions.
 *
 * A composition is rendered to video and then played over gameplay at whatever
 * size the scene happens to be. Nobody is going to squint at it and adjust a
 * shade — so the contrast decisions have to be made here, from the brand's own
 * palette, rather than left to whatever the template author guessed.
 *
 * `hyperframes check` runs a WCAG contrast audit over every composition, so
 * getting this right is also what keeps the render gate green.
 *
 * Pure functions, no imports. Deliberately: this is the one part of the
 * pipeline that is easy to test exhaustively, and it is worth being able to.
 */

export type Rgb = { r: number; g: number; b: number }

/** Parses `#RRGGBB`. Brand colours are validated by Zod, so this is the only shape. */
export function parseHex(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Not a 6-digit hex colour: ${hex}`)
  }
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

/** Linear blend. `amount` is how much of `b` ends up in the result. */
export function mix(a: string, b: string, amount: number): string {
  const t = Math.max(0, Math.min(1, amount))
  const from = parseHex(a)
  const to = parseHex(b)
  return toHex({
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  })
}

export const lighten = (hex: string, amount: number) => mix(hex, '#FFFFFF', amount)
export const darken = (hex: string, amount: number) => mix(hex, '#000000', amount)

/** `rgba(...)` for the same colour at a given opacity. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex)
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  const channel = (value: number) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

export const isDark = (hex: string) => luminance(hex) < 0.2

/**
 * The most readable of `candidates` against `background`.
 *
 * Strictly maximising, so it is the right tool when legibility is the only
 * thing that matters — a badge, a plate, a label over a solid fill. It is the
 * *wrong* tool for body text in a brand colour: given a near-black brand ink on
 * white it will return pure black, trading the brand's own shade for a contrast
 * gain nobody can see. Use `ensureContrast` for that.
 *
 * Plain white and black are appended as a floor, so a palette of five muddy
 * mid-tones still produces something readable.
 */
export function bestContrast(background: string, candidates: string[]): string {
  const options = [...candidates, '#FFFFFF', '#000000']
  let best = options[0]
  let bestRatio = -1

  for (const option of options) {
    const ratio = contrast(background, option)
    if (ratio > bestRatio) {
      best = option
      bestRatio = ratio
    }
  }

  return best
}

/**
 * The candidate that reads best across *every* background it may sit on.
 *
 * A gradient is the case that motivates this: text on a panel running from
 * primary to secondary has two backgrounds, not one, and picking a colour
 * against only the first leaves the other end illegible. Maximising the worst
 * ratio rather than the average is deliberate — the weakest point is the one
 * anybody notices.
 */
export function bestContrastAcross(backgrounds: string[], candidates: string[]): string {
  const options = [...candidates, '#FFFFFF', '#000000']
  let best = options[0]
  let bestRatio = -1

  for (const option of options) {
    const worst = Math.min(...backgrounds.map((background) => contrast(background, option)))
    if (worst > bestRatio) {
      best = option
      bestRatio = worst
    }
  }

  return best
}

/**
 * Nudges `color` until it reads clearly on `background`.
 *
 * Used for accents that must stay recognisably themselves — a brand's purple
 * has to still look purple. It walks toward white or black (whichever the
 * background is not) in small steps and stops at the first shade that clears
 * `target`, so it changes the colour as little as the requirement allows.
 */
export function ensureContrast(color: string, background: string, target = 4.5): string {
  if (contrast(color, background) >= target) return color

  const toward = isDark(background) ? '#FFFFFF' : '#000000'
  for (let step = 1; step <= 20; step++) {
    const candidate = mix(color, toward, step / 20)
    if (contrast(candidate, background) >= target) return candidate
  }

  return toward
}
