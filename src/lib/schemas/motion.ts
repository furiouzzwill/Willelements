import { z } from 'zod'

/**
 * A composed alert animation.
 *
 * The six named entrances were a ceiling: whatever anyone described, the answer
 * was one of six, so every design settled into the same handful of looks. This
 * replaces the name with a **timeline** — per part, a list of keyframes with
 * real numbers — which the renderer compiles into actual CSS `@keyframes`.
 *
 * It does not cross the line `docs/ai-generation.md` draws. Nothing here is
 * code: a track is a part name from a closed set, an easing from a closed set,
 * and numbers. The application writes every character of the CSS. A model that
 * returned a script would be rejected by this schema before anything read it,
 * the same as an invented element type is today.
 *
 * Every number is bounded. An unclamped translate would push an alert off the
 * canvas and a huge scale would cover the stream — a validated specification
 * has to be validated against what it will do, not only against its shape.
 */

/** What a track can move. `card` is the alert as a whole. */
export const MOTION_PARTS = [
  'card',
  'logo',
  'label',
  'username',
  'message',
  'amount',
] as const

export type MotionPart = (typeof MOTION_PARTS)[number]

/**
 * Easings, as CSS timing functions.
 *
 * Named rather than free-form `cubic-bezier(...)`: the values go straight into
 * a stylesheet, and a closed list is the difference between interpolating a
 * keyword and interpolating whatever a model felt like writing.
 */
export const MOTION_EASINGS = [
  'linear',
  'ease-out',
  'ease-in',
  'ease-in-out',
  'overshoot',
  'anticipate',
  'sharp',
  'bounce-out',
] as const

export type MotionEasing = (typeof MOTION_EASINGS)[number]

export const EASING_CSS: Record<MotionEasing, string> = {
  linear: 'linear',
  'ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  'ease-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
  'ease-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
  // Travels past the target and comes back — the "pop" of an energetic brand.
  overshoot: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  // Pulls back before moving, which reads as winding up.
  anticipate: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
  sharp: 'cubic-bezier(0.9, 0, 0.1, 1)',
  'bounce-out': 'cubic-bezier(0.22, 1.4, 0.36, 1)',
}

/**
 * One moment in a track, as a percentage through it.
 *
 * Only transform and opacity, deliberately — those are the two things a browser
 * animates on the compositor without laying out or painting again, which is
 * what keeps an alert from costing frames while the same machine encodes a
 * stream. `blur` is the one exception and is capped low for that reason.
 */
export const motionKeyframe = z.object({
  /** Position through the track, 0 to 100. */
  at: z.number().min(0).max(100),
  opacity: z.number().min(0).max(1).optional(),
  /** Pixels on a 1920×1080 canvas. Bounded so nothing leaves the frame. */
  x: z.number().min(-400).max(400).optional(),
  y: z.number().min(-400).max(400).optional(),
  scale: z.number().min(0).max(3).optional(),
  rotate: z.number().min(-720).max(720).optional(),
  skewX: z.number().min(-45).max(45).optional(),
  /** Pixels. Capped: blur is the one property here that costs real paint time. */
  blur: z.number().min(0).max(20).optional(),
})

export type MotionKeyframe = z.infer<typeof motionKeyframe>

export const motionTrack = z.object({
  part: z.enum(MOTION_PARTS),
  /** Milliseconds before this track starts. */
  delayMs: z.number().int().min(0).max(4000),
  durationMs: z.number().int().min(80).max(6000),
  easing: z.enum(MOTION_EASINGS),
  /** At least a start and an end. Ordering is normalised by the compiler. */
  keyframes: z.array(motionKeyframe).min(2).max(8),
})

export type MotionTrack = z.infer<typeof motionTrack>

/**
 * The whole composed animation.
 *
 * Optional on an alert: alerts saved before this existed keep their named
 * entrance, and the renderer falls back to it. A migration that rewrote every
 * stored spec would have thrown away working alerts to gain nothing.
 */
export const motionTimeline = z.object({
  tracks: z.array(motionTrack).min(1).max(8),
  /** How the whole alert leaves. Kept simple — the exit is not the interesting part. */
  exitMs: z.number().int().min(120).max(1200).default(320),
})

export type MotionTimeline = z.infer<typeof motionTimeline>
