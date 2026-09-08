import {
  EASING_CSS,
  type MotionKeyframe,
  type MotionPart,
  type MotionTimeline,
  type MotionTrack,
} from '@/lib/schemas/motion'

/**
 * A validated timeline becomes real CSS.
 *
 * This is the piece that keeps `docs/ai-generation.md` honest. A model supplies
 * numbers; **this module writes every character of the stylesheet**. Nothing
 * that arrives from outside is ever concatenated into the output — parts and
 * easings are looked up in tables, and numbers are rounded and clamped on the
 * way through. There is no path from a generated string to a rule.
 *
 * The output is plain `@keyframes` plus an `animation` shorthand per part, so
 * it runs identically in the OBS browser source and in the dashboard preview,
 * and costs the compositor rather than the main thread.
 */

/** Ties one alert's rules to one alert instance, so two on screen cannot collide. */
export type CompiledMotion = {
  css: string
  /** Per part, the `animation` shorthand to put on that element. */
  animations: Partial<Record<MotionPart, string>>
}

/** Rounds and drops float noise; every value here ends up in a stylesheet. */
function round(value: number, places = 3): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/**
 * One keyframe as a CSS declaration block.
 *
 * Transform properties are composed in a fixed order. Order matters in CSS
 * transforms — translate then rotate is not rotate then translate — and fixing
 * it here means a track behaves the same however the model happened to list
 * its properties.
 */
function declarations(frame: MotionKeyframe): string {
  const parts: string[] = []

  if (frame.x !== undefined || frame.y !== undefined) {
    parts.push(`translate3d(${round(frame.x ?? 0)}px, ${round(frame.y ?? 0)}px, 0)`)
  }
  if (frame.rotate !== undefined) parts.push(`rotate(${round(frame.rotate)}deg)`)
  if (frame.skewX !== undefined) parts.push(`skewX(${round(frame.skewX)}deg)`)
  if (frame.scale !== undefined) parts.push(`scale(${round(frame.scale)})`)

  const rules: string[] = []
  if (parts.length > 0) rules.push(`transform: ${parts.join(' ')}`)
  if (frame.opacity !== undefined) rules.push(`opacity: ${round(frame.opacity)}`)
  if (frame.blur !== undefined) rules.push(`filter: blur(${round(frame.blur)}px)`)

  // A keyframe that set nothing would produce `{ }`, which is legal but makes
  // the browser hold the previous value rather than interpolate to a known one.
  return rules.length > 0 ? rules.join('; ') : 'opacity: 1'
}

function keyframesFor(name: string, track: MotionTrack): string {
  // Sorted and de-duplicated: two frames at the same percentage make the second
  // win silently, and an out-of-order list is a track that plays backwards in
  // places.
  const seen = new Set<number>()
  const frames = [...track.keyframes]
    .sort((a, b) => a.at - b.at)
    .filter((frame) => {
      const at = round(frame.at, 2)
      if (seen.has(at)) return false
      seen.add(at)
      return true
    })

  const body = frames
    .map((frame) => `  ${round(frame.at, 2)}% { ${declarations(frame)} }`)
    .join('\n')

  return `@keyframes ${name} {\n${body}\n}`
}

/**
 * Compiles a timeline for one alert instance.
 *
 * `id` must be unique per rendered alert. Two alerts queued back to back would
 * otherwise share keyframe names, and the second would silently animate with
 * the first one's motion.
 */
export function compileMotion(timeline: MotionTimeline, id: string): CompiledMotion {
  // The id reaches a CSS identifier, so it is reduced to characters that cannot
  // mean anything there rather than trusted.
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'alert'

  const blocks: string[] = []
  const animations: Partial<Record<MotionPart, string>> = {}

  // One track per part wins — the last listed, so a model that repeats itself
  // gets its final intent rather than a silent overlay of two animations on one
  // element, which CSS resolves in a way nobody would predict.
  const byPart = new Map<MotionPart, MotionTrack>()
  for (const track of timeline.tracks) byPart.set(track.part, track)

  for (const [part, track] of byPart) {
    const name = `we-${safeId}-${part}`
    blocks.push(keyframesFor(name, track))

    animations[part] =
      `${name} ${track.durationMs}ms ${EASING_CSS[track.easing]} ${track.delayMs}ms both`
  }

  return { css: blocks.join('\n\n'), animations }
}

/**
 * A reasonable timeline for an alert that has none.
 *
 * Used when an older alert is rendered through the composed path, so the two
 * code paths cannot disagree about what "no motion specified" looks like.
 */
export function defaultTimeline(): MotionTimeline {
  return {
    exitMs: 320,
    tracks: [
      {
        part: 'card',
        delayMs: 0,
        durationMs: 480,
        easing: 'ease-out',
        keyframes: [
          { at: 0, opacity: 0, y: 24 },
          { at: 100, opacity: 1, y: 0 },
        ],
      },
    ],
  }
}
