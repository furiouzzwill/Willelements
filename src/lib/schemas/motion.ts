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
  /**
   * Independent axes, which is what squash and stretch actually is. A single
   * `scale` can only make something bigger or smaller; a thing that lands and
   * squashes needs its width and height to disagree for a few frames.
   */
  scaleX: z.number().min(0).max(3).optional(),
  scaleY: z.number().min(0).max(3).optional(),
  rotate: z.number().min(-720).max(720).optional(),
  /** Rotation in depth. With perspective this is a card flip rather than a spin. */
  rotateX: z.number().min(-360).max(360).optional(),
  rotateY: z.number().min(-360).max(360).optional(),
  skewX: z.number().min(-45).max(45).optional(),
  skewY: z.number().min(-45).max(45).optional(),
  /** Letter spacing in em. Cheap to animate and reads as tension or release. */
  tracking: z.number().min(-0.1).max(1).optional(),
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
  /**
   * How many times the track plays.
   *
   * A shake, a pulse or a wobble is one short motion repeated, not eight
   * keyframes spelling out every bounce. Capped: an alert that never settles
   * is a distraction on someone's stream.
   */
  repeat: z.number().int().min(1).max(8).prefault(1),
  /** Play alternate repeats backwards, which is what makes a pulse breathe. */
  yoyo: z.boolean().prefault(false),
  /** At least a start and an end. Ordering is normalised by the compiler. */
  keyframes: z.array(motionKeyframe).min(2).max(10),
})

export type MotionTrack = z.infer<typeof motionTrack>

/**
 * Extra visual layers the alert can spawn.
 *
 * The vocabulary exists so a description like "particles exploding outward"
 * has somewhere to land other than the nearest translate. Each kind is a shape
 * this app knows how to draw and animate; the specification chooses which,
 * how many and how far, and the app draws every one of them.
 */
export const DECORATION_KINDS = ['burst', 'shine', 'ring', 'rays'] as const

export type DecorationKind = (typeof DECORATION_KINDS)[number]

export const decoration = z.object({
  kind: z.enum(DECORATION_KINDS),
  /** Sprites for a burst, spokes for rays. Ignored by shine and ring. */
  count: z.number().int().min(1).max(24).prefault(10),
  /** Degrees of arc the pieces are spread across. 360 is all directions. */
  spread: z.number().min(10).max(360).prefault(360),
  /** How far pieces travel, in pixels. */
  distance: z.number().min(10).max(600).prefault(180),
  /** Piece size in pixels. */
  size: z.number().min(2).max(80).prefault(10),
  delayMs: z.number().int().min(0).max(4000).prefault(0),
  durationMs: z.number().int().min(120).max(4000).prefault(700),
  easing: z.enum(MOTION_EASINGS).prefault('ease-out'),
  /** Which brand colour to draw it in. */
  color: z.enum(['primary', 'secondary', 'accent', 'text']).prefault('accent'),
  /** Round pieces read as sparks; square ones read as confetti. */
  shape: z.enum(['circle', 'square', 'bar']).prefault('circle'),
  /** Fade the pieces out as they travel, rather than leaving them on screen. */
  fade: z.boolean().prefault(true),
})

export type Decoration = z.infer<typeof decoration>

/**
 * The whole composed animation.
 *
 * Optional on an alert: alerts saved before this existed keep their named
 * entrance, and the renderer falls back to it. A migration that rewrote every
 * stored spec would have thrown away working alerts to gain nothing.
 */
export const motionTimeline = z.object({
  tracks: z.array(motionTrack).min(1).max(8),
  /** Optional extra layers — bursts, sweeps, rings. */
  decorations: z.array(decoration).max(3).prefault([]),
  /**
   * Depth for rotateX/rotateY, in pixels.
   *
   * Without it a 3D rotation is a flat squash: the browser has nothing to
   * project through, so the flip nobody asked for looks like a scale.
   */
  perspective: z.number().min(0).max(2400).prefault(900),
  /** How the whole alert leaves. Kept simple — the exit is not the interesting part. */
  exitMs: z.number().int().min(120).max(1200).default(320),
})

export type MotionTimeline = z.infer<typeof motionTimeline>

/**
 * The shape a caller supplies, before defaults are filled in.
 *
 * Distinct from `MotionTimeline` because several fields have defaults: the
 * parsed value always has `repeat` and `yoyo`, but nothing writing a timeline
 * by hand should have to say `repeat: 1`.
 */
export type MotionTimelineInput = z.input<typeof motionTimeline>
