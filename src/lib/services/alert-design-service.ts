import 'server-only'

import { randomUUID } from 'node:crypto'
import { desc } from 'drizzle-orm'

import { getDb } from '@/lib/db'
import { aiCommands, type AiCommand } from '@/lib/db/schema'
import { generateStructured, hasApiKey, TextProviderError } from '@/lib/providers/openai/text'
import {
  alertSpec,
  DEFAULT_LABELS,
  ELEMENT_ANIMATIONS,
  ENTRANCE_ANIMATIONS,
  EXIT_ANIMATIONS,
  type AlertSpec,
} from '@/lib/schemas/alert'
import { EVENT_LABELS, type EventType } from '@/lib/schemas/event'
import { DECORATION_KINDS, MOTION_EASINGS, MOTION_PARTS } from '@/lib/schemas/motion'
import { getDefaultBrand } from '@/lib/services/brand-service'
import { tokensToCost, TEXT_MODEL } from '@/lib/providers/openai/pricing'

/**
 * "Make it look like this" — in words — becomes a validated alert spec.
 *
 * The boundary `docs/ai-generation.md` draws is the whole design: the model
 * returns a **specification**, never code, never markup, never CSS. The
 * elements it may use are a closed set defined by this app, and anything
 * outside that set is rejected rather than passed through and hoped for.
 *
 * Two filters, deliberately, because they catch different things:
 *
 *  1. The provider's strict JSON-schema mode, which stops a malformed shape or
 *     an invented enum value at the source.
 *  2. This app's own Zod parse, which is the one that actually decides. A
 *     provider that changes behaviour, or a schema that drifts from the code,
 *     fails here rather than reaching the overlay.
 */

export class AlertDesignError extends Error {}

/**
 * The JSON Schema handed to the provider.
 *
 * Built from the same constants the renderer uses, so the two cannot disagree.
 * Writing this literal by hand would create exactly the drift the closed
 * element set exists to prevent — a new animation added to the app but never
 * offered to the model, or worse, offered but not renderable.
 */
export function buildAlertJsonSchema(): Record<string, unknown> {
  const element = (type: string, extra: Record<string, unknown> = {}) => ({
    type: 'object',
    additionalProperties: false,
    required: ['type', 'animation', ...Object.keys(extra)],
    properties: {
      type: { type: 'string', enum: [type] },
      animation: { type: 'string', enum: [...ELEMENT_ANIMATIONS] },
      ...extra,
    },
  })

  const keyframe = {
    type: 'object',
    additionalProperties: false,
    // Strict mode requires every property to be listed as required, so the
    // model is asked for all of them and the unused ones are given neutral
    // values rather than omitted.
    required: [
      'at', 'opacity', 'x', 'y', 'scale', 'scaleX', 'scaleY',
      'rotate', 'rotateX', 'rotateY', 'skewX', 'skewY', 'tracking', 'blur',
    ],
    properties: {
      at: { type: 'number', description: '0 to 100, position through the track' },
      opacity: { type: 'number', description: '0 to 1' },
      x: { type: 'number', description: 'pixels, -400 to 400' },
      y: { type: 'number', description: 'pixels, -400 to 400' },
      scale: { type: 'number', description: '0 to 3, 1 is natural size' },
      scaleX: { type: 'number', description: '0 to 3, width only — squash and stretch' },
      scaleY: { type: 'number', description: '0 to 3, height only — squash and stretch' },
      rotate: { type: 'number', description: 'degrees in the plane, -720 to 720' },
      rotateX: { type: 'number', description: 'degrees in depth, -360 to 360, a flip' },
      rotateY: { type: 'number', description: 'degrees in depth, -360 to 360, a flip' },
      skewX: { type: 'number', description: 'degrees, -45 to 45' },
      skewY: { type: 'number', description: 'degrees, -45 to 45' },
      tracking: { type: 'number', description: 'letter spacing in em, -0.1 to 1' },
      blur: { type: 'number', description: 'pixels, 0 to 20' },
    },
  }

  const decorationSchema = {
    type: 'object',
    additionalProperties: false,
    required: [
      'kind', 'count', 'spread', 'distance', 'size',
      'delayMs', 'durationMs', 'easing', 'color', 'shape', 'fade',
    ],
    properties: {
      kind: { type: 'string', enum: [...DECORATION_KINDS] },
      count: { type: 'integer', description: 'pieces, 1 to 24 (burst and rays)' },
      spread: { type: 'number', description: 'degrees of arc, 10 to 360' },
      distance: { type: 'number', description: 'travel in pixels, 10 to 600' },
      size: { type: 'number', description: 'piece size in pixels, 2 to 80' },
      delayMs: { type: 'integer', description: '0 to 4000' },
      durationMs: { type: 'integer', description: '120 to 4000' },
      easing: { type: 'string', enum: [...MOTION_EASINGS] },
      color: { type: 'string', enum: ['primary', 'secondary', 'accent', 'text'] },
      shape: { type: 'string', enum: ['circle', 'square', 'bar'] },
      fade: { type: 'boolean' },
    },
  }

  const track = {
    type: 'object',
    additionalProperties: false,
    required: ['part', 'delayMs', 'durationMs', 'easing', 'repeat', 'yoyo', 'keyframes'],
    properties: {
      part: { type: 'string', enum: [...MOTION_PARTS] },
      delayMs: { type: 'integer', description: '0 to 4000' },
      durationMs: { type: 'integer', description: '80 to 6000' },
      easing: { type: 'string', enum: [...MOTION_EASINGS] },
      repeat: { type: 'integer', description: 'times to play, 1 to 8' },
      yoyo: { type: 'boolean', description: 'play alternate repeats backwards' },
      keyframes: { type: 'array', items: keyframe },
    },
  }

  return {
    type: 'object',
    additionalProperties: false,
    required: ['layout', 'elements', 'entrance', 'exit', 'showLogo', 'volume', 'motion'],
    properties: {
      layout: { type: 'string', enum: ['centered', 'left', 'right', 'banner'] },
      entrance: { type: 'string', enum: [...ENTRANCE_ANIMATIONS] },
      exit: { type: 'string', enum: [...EXIT_ANIMATIONS] },
      showLogo: { type: 'boolean' },
      volume: { type: 'number' },
      motion: {
        type: 'object',
        additionalProperties: false,
        required: ['tracks', 'decorations', 'perspective', 'exitMs'],
        properties: {
          tracks: { type: 'array', items: track },
          decorations: { type: 'array', items: decorationSchema },
          perspective: { type: 'number', description: 'depth in px for 3D flips, 0 to 2400' },
          exitMs: { type: 'integer', description: '120 to 1200' },
        },
      },
      elements: {
        type: 'array',
        minItems: 1,
        items: {
          anyOf: [
            element('logo'),
            element('label', {
              value: { type: 'string', description: 'Static text, e.g. NEW FOLLOWER' },
            }),
            element('username'),
            element('message'),
            element('amount'),
          ],
        },
      },
    },
  }
}

const SYSTEM = `You design alert overlays for a live streaming app.

You return a specification object only. You never return code, HTML, CSS or
markup of any kind — the application renders the specification itself, and
anything outside the given schema is discarded.

The element types are fixed and mean:
- logo      the streamer's brand logo image
- label     a short static line such as "NEW FOLLOWER" (you choose the words)
- username  the name of whoever triggered the alert, filled in live
- message   their message, where the event carries one
- amount    bits, months or viewer count, where the event carries one

Rules you must follow:
- Use only element types that make sense for the event being designed for.
- "username" should appear in almost every alert — it is the point of an alert.
- Keep elements to at most four. A crowded alert is unreadable in two seconds.
- volume is 0 to 1. Use 0.6 unless the description asks for loud or quiet.
- The label text should be short and upper case.

MOTION is the important part, and it is yours to compose. Do not settle for a
generic fade — the "motion" object is where a description becomes a distinct
animation, and two different descriptions must never produce the same timeline.

Each track animates one part between keyframes you choose:
- Use "card" to move the whole alert, and name individual parts to have them
  arrive separately. Staggered delays read as choreography; everything at once
  reads as a single lump.
- Keyframes are 0 to 100 percent through that track. Always give one at 0 and
  one at 100, and put intermediate ones wherever the interest is.
- Every keyframe must set all eight fields. For any you do not want to change,
  use the resting value: opacity 1, x 0, y 0, scale 1, rotate 0, skewX 0,
  blur 0.
- Think about what the words mean physically, and use the whole vocabulary:
  - "Slam" — big scale from above, overshoot easing, short duration, then
    scaleX above 1 with scaleY below it for a frame or two so it squashes on
    landing and springs back.
  - "Drift" — small translate over a long duration with linear easing.
  - "Glitchy" — several small opposing x offsets and skews, or a short track
    with repeat 3 to 6.
  - "Wind up" — anticipate easing with a keyframe that moves the wrong way
    first.
  - "Flip" or "card turning" — rotateY from 90 or -90 to 0.
  - "Shake", "pulse", "throb", "wobble" — a short two-or-three keyframe track
    with repeat above 1. Add yoyo true for anything that should breathe rather
    than restart.
  - "Tighten" or "expand" — animate tracking on a text part.
- Total length should be roughly 400 to 1600ms including delays. An alert that
  is still arriving after two seconds has missed its moment.

DECORATIONS are extra layers, and they are how a description gets particles,
sparks, confetti or a shine rather than the nearest translate. Use them when
the description calls for something the parts themselves cannot be:
- burst — count pieces thrown outward across spread degrees. Confetti is
  shape square with a wide spread; sparks are shape circle, small size, fast.
- rays — spokes stretching outward from the centre. Good for "explode",
  "radiate", "shine out".
- ring — a single expanding circle. Good for "shockwave", "pulse out", "impact".
- shine — a highlight sweeping across. Good for "gleam", "polish", "premium".
Use at most two, and none at all for anything described as minimal or calm —
scenery on a restrained alert is the opposite of what was asked for.

Also set "entrance" and "exit" to the nearest of the older named animations.
They are a fallback for anything that cannot play your timeline.`

export type DesignRequest = {
  eventType: EventType
  /** What the person typed. */
  description: string
}

export type DesignResult = {
  spec: AlertSpec
  command: AiCommand
}

export async function designAlert(request: DesignRequest): Promise<DesignResult> {
  const description = request.description.trim()
  if (!description) throw new AlertDesignError('Describe the alert you want.')

  const brand = getDefaultBrand()
  if (!brand) throw new AlertDesignError('No brand to design against.')

  const { colors, visualStyle, personality } = brand.dna

  // The brand goes in as context, not as instruction. Colours are applied by
  // the renderer from Brand DNA regardless of what the model says — it is
  // choosing structure and motion, not palette.
  const user = [
    `Event: ${EVENT_LABELS[request.eventType]} (${request.eventType}).`,
    `Suggested label if nothing better fits: ${DEFAULT_LABELS[request.eventType] ?? 'ALERT'}.`,
    `Brand style: ${visualStyle.style}, ${visualStyle.detail} detail, ${visualStyle.canvas} canvas.`,
    personality.length ? `Brand character: ${personality.join(', ')}.` : '',
    `Brand colours are applied by the renderer, so do not describe colours: ${colors.primary}, ${colors.accent}.`,
    '',
    `Design this alert: ${description}`,
  ]
    .filter(Boolean)
    .join('\n')

  const common = {
    brandId: brand.id,
    kind: 'alert-design',
    model: TEXT_MODEL,
    prompt: description,
    target: request.eventType,
  }

  try {
    const result = await generateStructured({
      model: TEXT_MODEL,
      system: SYSTEM,
      user,
      schema: buildAlertJsonSchema(),
      schemaName: 'alert_spec',
    })

    // The decision point. Strict mode is a filter; this is the gate.
    const parsed = alertSpec.safeParse(result.value)
    if (!parsed.success) {
      throw new AlertDesignError(
        `The design came back in a shape this app cannot render: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
      )
    }

    const command = getDb()
      .insert(aiCommands)
      .values({
        id: randomUUID(),
        ...common,
        result: parsed.data,
        costEstimate: tokensToCost(result.inputTokens, result.outputTokens),
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        status: 'succeeded',
      })
      .returning()
      .get()

    return { spec: parsed.data, command }
  } catch (error) {
    const message =
      error instanceof TextProviderError || error instanceof AlertDesignError
        ? error.message
        : 'That design could not be generated.'

    getDb()
      .insert(aiCommands)
      .values({
        id: randomUUID(),
        ...common,
        result: null,
        // Not zero: a refused or failed call is not billed, and zero would
        // claim we know it was free.
        costEstimate: null,
        status: 'failed',
        error: message,
      })
      .run()

    throw error instanceof AlertDesignError ? error : new AlertDesignError(message)
  }
}

export function listAlertDesigns(limit = 20): AiCommand[] {
  return getDb()
    .select()
    .from(aiCommands)
    .orderBy(desc(aiCommands.createdAt))
    .limit(limit)
    .all()
}

/** Estimated dollars spent designing alerts, and how many had no usable figure. */
export function designSpend(): { total: number; unpricedCount: number; count: number } {
  const rows = getDb().select().from(aiCommands).all()
  const succeeded = rows.filter((row) => row.status === 'succeeded')

  return {
    total:
      Math.round(succeeded.reduce((sum, row) => sum + (row.costEstimate ?? 0), 0) * 1_000_000) /
      1_000_000,
    unpricedCount: succeeded.filter((row) => row.costEstimate === null).length,
    count: succeeded.length,
  }
}

export { hasApiKey }
