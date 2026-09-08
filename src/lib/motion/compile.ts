import {
  motionTimeline,
  EASING_CSS,
  type Decoration,
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

/** One drawable piece of a decoration, positioned and animated by this module. */
export type DecorationPiece = {
  /** Inline style for the element the renderer creates. */
  style: Record<string, string | number>
}

export type CompiledDecoration = {
  kind: string
  pieces: DecorationPiece[]
}

/** Ties one alert's rules to one alert instance, so two on screen cannot collide. */
export type CompiledMotion = {
  css: string
  /** Per part, the `animation` shorthand to put on that element. */
  animations: Partial<Record<MotionPart, string>>
  /** Extra layers the renderer draws behind and around the alert. */
  decorations: CompiledDecoration[]
  /** Depth for any 3D rotation in the timeline. */
  perspective: number
}

/**
 * Brand colours, by the name a specification is allowed to use.
 *
 * A lookup rather than a passthrough: the value ends up in a stylesheet, and
 * this is the difference between choosing a colour and supplying one.
 */
const COLOR_VAR: Record<Decoration['color'], string> = {
  primary: 'var(--we-primary)',
  secondary: 'var(--we-secondary)',
  accent: 'var(--we-accent)',
  text: 'var(--we-text)',
}

/**
 * Turns one decoration into drawable pieces plus the keyframes to move them.
 *
 * The geometry is computed here — a burst is `count` pieces spread evenly over
 * `spread` degrees, each travelling `distance` outward — so the specification
 * says what it wants and this module works out where everything goes. That is
 * the same division as everywhere else: numbers in, drawing decided by the app.
 */
function compileDecoration(
  decoration: Decoration,
  id: string,
  index: number,
): { css: string; compiled: CompiledDecoration } {
  const name = `we-${id}-dec${index}`
  const color = COLOR_VAR[decoration.color]
  const easing = EASING_CSS[decoration.easing]
  const pieces: DecorationPiece[] = []
  const blocks: string[] = []

  const radius = decoration.shape === 'circle' ? '50%' : decoration.shape === 'bar' ? '999px' : '2px'

  if (decoration.kind === 'burst' || decoration.kind === 'rays') {
    // Evenly spaced across the arc. A full circle divides by count; a narrower
    // spread divides by the gaps so the first and last land on the edges.
    const step =
      decoration.spread >= 360
        ? 360 / decoration.count
        : decoration.count > 1
          ? decoration.spread / (decoration.count - 1)
          : 0
    const start = decoration.spread >= 360 ? 0 : -decoration.spread / 2

    for (let piece = 0; piece < decoration.count; piece += 1) {
      const angle = start + step * piece
      const radians = (angle * Math.PI) / 180
      const dx = round(Math.cos(radians) * decoration.distance, 1)
      const dy = round(Math.sin(radians) * decoration.distance, 1)
      const pieceName = `${name}-${piece}`

      // Rays stretch outward from the centre; a burst throws pieces away from it.
      blocks.push(
        decoration.kind === 'rays'
          ? `@keyframes ${pieceName} {\n` +
            `  0% { transform: rotate(${round(angle, 1)}deg) scaleX(0); opacity: 0 }\n` +
            `  40% { opacity: 1 }\n` +
            `  100% { transform: rotate(${round(angle, 1)}deg) scaleX(1); opacity: ${decoration.fade ? 0 : 1} }\n}`
          : `@keyframes ${pieceName} {\n` +
            `  0% { transform: translate3d(0,0,0) scale(0.4); opacity: 0 }\n` +
            `  25% { opacity: 1 }\n` +
            `  100% { transform: translate3d(${dx}px, ${dy}px, 0) scale(1); opacity: ${decoration.fade ? 0 : 1} }\n}`,
      )

      // Each piece leaves at a slightly different moment. Simultaneous
      // departure reads as one expanding ring rather than as debris.
      const stagger = Math.round((decoration.durationMs / decoration.count) * 0.25 * piece)

      pieces.push({
        style: {
          position: 'absolute',
          left: '50%',
          top: '50%',
          width:
            decoration.kind === 'rays'
              ? `${Math.round(decoration.distance)}px`
              : `${Math.round(decoration.size)}px`,
          height: `${Math.round(decoration.kind === 'rays' ? Math.max(2, decoration.size / 4) : decoration.size)}px`,
          marginLeft: decoration.kind === 'rays' ? '0' : `${-decoration.size / 2}px`,
          marginTop: `${-(decoration.kind === 'rays' ? Math.max(2, decoration.size / 4) : decoration.size) / 2}px`,
          borderRadius: radius,
          background: color,
          transformOrigin: decoration.kind === 'rays' ? 'left center' : 'center',
          pointerEvents: 'none',
          animation: `${pieceName} ${decoration.durationMs}ms ${easing} ${decoration.delayMs + stagger}ms both`,
        },
      })
    }
  }

  if (decoration.kind === 'ring') {
    blocks.push(
      `@keyframes ${name}-0 {\n` +
        `  0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0 }\n` +
        `  30% { opacity: 0.9 }\n` +
        `  100% { transform: translate(-50%, -50%) scale(1); opacity: ${decoration.fade ? 0 : 0.6} }\n}`,
    )
    pieces.push({
      style: {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: `${Math.round(decoration.distance * 2)}px`,
        height: `${Math.round(decoration.distance * 2)}px`,
        borderRadius: '50%',
        border: `${Math.max(2, Math.round(decoration.size / 4))}px solid ${color}`,
        pointerEvents: 'none',
        animation: `${name}-0 ${decoration.durationMs}ms ${easing} ${decoration.delayMs}ms both`,
      },
    })
  }

  if (decoration.kind === 'shine') {
    blocks.push(
      `@keyframes ${name}-0 {\n` +
        `  0% { transform: translateX(-140%) skewX(-18deg); opacity: 0 }\n` +
        `  20% { opacity: 0.85 }\n` +
        `  100% { transform: translateX(240%) skewX(-18deg); opacity: 0 }\n}`,
    )
    pieces.push({
      style: {
        position: 'absolute',
        left: '0',
        top: '0',
        bottom: '0',
        width: `${Math.round(decoration.size * 3)}px`,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        pointerEvents: 'none',
        animation: `${name}-0 ${decoration.durationMs}ms ${easing} ${decoration.delayMs}ms both`,
      },
    })
  }

  return { css: blocks.join('\n\n'), compiled: { kind: decoration.kind, pieces } }
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
  if (frame.rotateX !== undefined) parts.push(`rotateX(${round(frame.rotateX)}deg)`)
  if (frame.rotateY !== undefined) parts.push(`rotateY(${round(frame.rotateY)}deg)`)
  if (frame.skewX !== undefined) parts.push(`skewX(${round(frame.skewX)}deg)`)
  if (frame.skewY !== undefined) parts.push(`skewY(${round(frame.skewY)}deg)`)

  // Independent axes win over uniform scale when both are given: a spec that
  // says "squash" has said something more specific than "smaller".
  if (frame.scaleX !== undefined || frame.scaleY !== undefined) {
    parts.push(
      `scale(${round(frame.scaleX ?? frame.scale ?? 1)}, ${round(frame.scaleY ?? frame.scale ?? 1)})`,
    )
  } else if (frame.scale !== undefined) {
    parts.push(`scale(${round(frame.scale)})`)
  }

  const rules: string[] = []
  if (parts.length > 0) rules.push(`transform: ${parts.join(' ')}`)
  if (frame.opacity !== undefined) rules.push(`opacity: ${round(frame.opacity)}`)
  if (frame.blur !== undefined) rules.push(`filter: blur(${round(frame.blur)}px)`)
  if (frame.tracking !== undefined) {
    rules.push(`letter-spacing: ${round(frame.tracking)}em`)
  }

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

    // `alternate` is what turns one motion into a pulse rather than a stutter:
    // without it every repeat snaps back to the start before playing again.
    const direction = track.yoyo ? 'alternate' : 'normal'
    animations[part] =
      `${name} ${track.durationMs}ms ${EASING_CSS[track.easing]} ${track.delayMs}ms ` +
      `${track.repeat} ${direction} both`
  }

  const decorations: CompiledDecoration[] = []
  timeline.decorations.forEach((decoration, index) => {
    const result = compileDecoration(decoration, safeId, index)
    blocks.push(result.css)
    decorations.push(result.compiled)
  })

  return {
    css: blocks.join('\n\n'),
    animations,
    decorations,
    perspective: timeline.perspective,
  }
}

/**
 * A reasonable timeline for an alert that has none.
 *
 * Used when an older alert is rendered through the composed path, so the two
 * code paths cannot disagree about what "no motion specified" looks like.
 */
export function defaultTimeline(): MotionTimeline {
  return motionTimeline.parse({
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
  })
}
