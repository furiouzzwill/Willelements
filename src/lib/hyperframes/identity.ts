import type { BrandDna } from '@/lib/schemas/brand'
import {
  bestContrastAcross,
  darken,
  ensureContrast,
  isDark,
  lighten,
  mix,
  withAlpha,
} from '@/lib/hyperframes/color'

/**
 * Brand DNA → a HyperFrames visual identity.
 *
 * Brand DNA is written for a human: "energetic", "glitch", "detailed". A
 * composition needs numbers: how many pixels does a title travel, on what easing
 * curve, over how long. This module is the whole of that translation, and it is
 * deliberately the only place it happens — every template reads the identity
 * rather than interpreting the DNA itself, so two templates can never disagree
 * about what "high energy" means.
 *
 * Pure, and free of `server-only` on purpose: it runs in tests and could run in
 * a browser preview later without moving.
 */

/** Timings and curves, in the units GSAP wants: seconds and easing strings. */
export type MotionIdentity = {
  duration: { quick: number; base: number; slow: number }
  ease: { entrance: string; exit: string; emphasis: string }
  /** How far an element travels before it settles, in canvas pixels. */
  travel: number
  /** Seconds between items in a staggered group. */
  stagger: number
  /** Optional treatments a template may honour if it has somewhere to put them. */
  accents: { glitch: boolean; sweep: boolean; bloom: boolean }
}

export type TypeIdentity = {
  headingStack: string
  bodyStack: string
  /** `uppercase` or `none`, as a CSS value. */
  transform: 'uppercase' | 'none'
  /** CSS letter-spacing for headings. */
  tracking: string
  headingWeight: number
  bodyWeight: number
}

export type ColorIdentity = {
  primary: string
  secondary: string
  accent: string
  background: string
  /** A slightly raised background, for panels and cards. */
  surface: string
  text: string
  /** Body text at reduced emphasis, still readable. */
  muted: string
  /** Text that sits on top of `primary`. */
  onPrimary: string
  /** The accent, adjusted if needed so it reads against the background. */
  accentOnBackground: string
}

export type VisualIdentity = {
  colors: ColorIdentity
  type: TypeIdentity
  motion: MotionIdentity
  surface: {
    /** Corner radius in canvas pixels. */
    radius: number
    /** Hairline rules and borders, in canvas pixels. */
    hairline: number
    vignette: boolean
    grain: boolean
    /** A soft radial wash behind the subject. */
    glow: boolean
  }
  /** `:root` custom properties, ready to drop into a composition's stylesheet. */
  css: string
}

/**
 * Base duration in seconds for one beat of motion.
 *
 * Everything else is a multiple of this, so changing brand speed retimes the
 * whole composition coherently instead of retiming one tween.
 */
const BASE_DURATION = { slow: 1, medium: 0.7, fast: 0.45 } as const

/** Travel distance and stagger, which is what energy actually looks like. */
const ENERGY = {
  low: { travel: 24, stagger: 0.1 },
  medium: { travel: 48, stagger: 0.075 },
  high: { travel: 88, stagger: 0.05 },
} as const

/**
 * Easing per motion style, and the accents that style implies.
 *
 * `durationScale` lets a style stretch or compress against the brand's speed —
 * cinematic is slow *for its speed setting*, not slow in absolute terms, so a
 * fast cinematic brand still reads as fast.
 */
const MOTION_STYLE = {
  smooth: {
    ease: { entrance: 'power2.out', exit: 'power2.in', emphasis: 'power2.inOut' },
    durationScale: 1,
    travelScale: 1,
    accents: {},
  },
  fast: {
    ease: { entrance: 'power4.out', exit: 'power3.in', emphasis: 'power3.inOut' },
    durationScale: 0.75,
    travelScale: 1.15,
    accents: {},
  },
  cinematic: {
    ease: { entrance: 'expo.out', exit: 'expo.in', emphasis: 'power2.inOut' },
    durationScale: 1.45,
    travelScale: 0.8,
    accents: { vignette: true },
  },
  glitch: {
    ease: { entrance: 'steps(5)', exit: 'steps(4)', emphasis: 'steps(3)' },
    durationScale: 0.7,
    travelScale: 1.1,
    accents: { glitch: true },
  },
  technical: {
    ease: { entrance: 'power1.out', exit: 'power1.in', emphasis: 'none' },
    durationScale: 0.85,
    travelScale: 0.7,
    accents: { sweep: true },
  },
  fluid: {
    ease: { entrance: 'sine.out', exit: 'sine.in', emphasis: 'sine.inOut' },
    durationScale: 1.2,
    travelScale: 0.9,
    accents: {},
  },
  explosive: {
    ease: { entrance: 'back.out(1.8)', exit: 'back.in(1.4)', emphasis: 'power4.inOut' },
    durationScale: 0.9,
    travelScale: 1.35,
    accents: { bloom: true },
  },
  minimal: {
    ease: { entrance: 'power1.out', exit: 'power1.in', emphasis: 'power1.inOut' },
    durationScale: 1.1,
    travelScale: 0.5,
    accents: {},
  },
} as const

/** Typographic treatment per visual style. */
const VISUAL_STYLE = {
  gaming: { transform: 'uppercase', tracking: '0.02em', heading: 800, body: 500, radius: 18 },
  futuristic: { transform: 'uppercase', tracking: '0.18em', heading: 600, body: 400, radius: 4 },
  minimal: { transform: 'none', tracking: '0em', heading: 500, body: 400, radius: 8 },
  luxury: { transform: 'uppercase', tracking: '0.32em', heading: 300, body: 300, radius: 2 },
  technical: { transform: 'uppercase', tracking: '0.12em', heading: 600, body: 400, radius: 2 },
  cinematic: { transform: 'uppercase', tracking: '0.24em', heading: 400, body: 300, radius: 0 },
  retro: { transform: 'uppercase', tracking: '0.06em', heading: 700, body: 500, radius: 12 },
  professional: { transform: 'none', tracking: '0.01em', heading: 600, body: 400, radius: 10 },
  energetic: { transform: 'uppercase', tracking: '0em', heading: 900, body: 600, radius: 24 },
} as const

/**
 * A font family the browser can be told about safely.
 *
 * Brand typography is free text, and it lands inside a stylesheet, so anything
 * that could close a declaration is stripped rather than escaped — a font name
 * has no legitimate use for a quote or a brace.
 *
 * Note that nothing here *loads* a font. The renderer uses whatever the machine
 * has installed, which is why every stack ends in a real system fallback.
 */
export function fontStack(family: string, fallback: string): string {
  const safe = family.replace(/[^A-Za-z0-9 _-]/g, '').trim()
  return safe ? `"${safe}", ${fallback}` : fallback
}

const SANS_FALLBACK = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

export function toVisualIdentity(dna: BrandDna): VisualIdentity {
  const style = VISUAL_STYLE[dna.visualStyle.style]

  // The brand names one background colour; the canvas setting says which end of
  // the scale the composition sits on. Honour both — keep the brand's hue, move
  // its lightness — rather than letting one silently win.
  const wantsLight = dna.visualStyle.canvas === 'light'
  const alreadyMatches = wantsLight !== isDark(dna.colors.background)
  const background = alreadyMatches
    ? dna.colors.background
    : mix(dna.colors.background, wantsLight ? '#FFFFFF' : '#000000', 0.88)

  const dark = isDark(background)
  const surface = dark ? lighten(background, 0.08) : darken(background, 0.05)
  // Keep the brand's own ink and only correct it if it is genuinely unreadable.
  // Maximising contrast here would quietly replace a considered near-black with
  // pure black on every light brand.
  const text = ensureContrast(dna.colors.text, background, 7)
  const muted = mix(text, background, 0.35)

  const colors: ColorIdentity = {
    primary: dna.colors.primary,
    secondary: dna.colors.secondary,
    accent: dna.colors.accent,
    background,
    surface,
    text,
    muted,
    // The mark's plate is a primary→secondary gradient, so the text on it has
    // two backgrounds. Pick against both, not just the one the gradient starts at.
    onPrimary: bestContrastAcross(
      [dna.colors.primary, dna.colors.secondary],
      [dna.colors.text, dna.colors.background],
    ),
    accentOnBackground: ensureContrast(dna.colors.accent, background),
  }

  // Motion styles are a set, not a ranking, so the first recognised entry sets
  // the curve and every entry contributes its accents. That way "glitch" still
  // registers as a glitch when it is listed second.
  const styles = dna.motionStyle.style.length > 0 ? dna.motionStyle.style : (['smooth'] as const)
  const lead = MOTION_STYLE[styles[0]]
  const accentSet = styles.map((name) => MOTION_STYLE[name].accents as Record<string, boolean>)
  const hasAccent = (key: string) => accentSet.some((accents) => accents[key] === true)

  const energy = ENERGY[dna.motionStyle.energy]
  const base = Number((BASE_DURATION[dna.motionStyle.speed] * lead.durationScale).toFixed(3))

  const motion: MotionIdentity = {
    duration: {
      quick: Number((base * 0.55).toFixed(3)),
      base,
      slow: Number((base * 1.6).toFixed(3)),
    },
    ease: { ...lead.ease },
    travel: Math.round(energy.travel * lead.travelScale),
    stagger: energy.stagger,
    accents: {
      glitch: hasAccent('glitch'),
      sweep: hasAccent('sweep'),
      bloom: hasAccent('bloom'),
    },
  }

  const detail = dna.visualStyle.detail

  const identity: Omit<VisualIdentity, 'css'> = {
    colors,
    type: {
      headingStack: fontStack(dna.typography.heading, SANS_FALLBACK),
      bodyStack: fontStack(dna.typography.body, SANS_FALLBACK),
      transform: style.transform,
      tracking: style.tracking,
      headingWeight: style.heading,
      bodyWeight: style.body,
    },
    motion,
    surface: {
      radius: style.radius,
      hairline: detail === 'minimal' ? 1 : detail === 'detailed' ? 4 : 2,
      vignette: detail !== 'minimal' || hasAccent('vignette'),
      grain: detail === 'detailed',
      glow: detail !== 'minimal',
    },
  }

  return { ...identity, css: toCssVariables(identity) }
}

/** The identity as `:root` custom properties, so templates read one vocabulary. */
function toCssVariables(identity: Omit<VisualIdentity, 'css'>): string {
  const { colors, type, motion, surface } = identity

  const entries: [string, string | number][] = [
    ['--hf-primary', colors.primary],
    ['--hf-secondary', colors.secondary],
    ['--hf-accent', colors.accent],
    ['--hf-accent-readable', colors.accentOnBackground],
    ['--hf-background', colors.background],
    ['--hf-surface', colors.surface],
    ['--hf-text', colors.text],
    ['--hf-muted', colors.muted],
    ['--hf-on-primary', colors.onPrimary],
    ['--hf-primary-soft', withAlpha(colors.primary, 0.25)],
    ['--hf-accent-soft', withAlpha(colors.accent, 0.2)],
    ['--hf-font-heading', type.headingStack],
    ['--hf-font-body', type.bodyStack],
    ['--hf-transform', type.transform],
    ['--hf-tracking', type.tracking],
    ['--hf-weight-heading', type.headingWeight],
    ['--hf-weight-body', type.bodyWeight],
    ['--hf-radius', `${surface.radius}px`],
    ['--hf-hairline', `${surface.hairline}px`],
    ['--hf-travel', `${motion.travel}px`],
  ]

  return entries.map(([name, value]) => `  ${name}: ${value};`).join('\n')
}
