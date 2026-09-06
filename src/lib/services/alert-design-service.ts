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

  return {
    type: 'object',
    additionalProperties: false,
    required: ['layout', 'elements', 'entrance', 'exit', 'showLogo', 'volume'],
    properties: {
      layout: { type: 'string', enum: ['centered', 'left', 'right', 'banner'] },
      entrance: { type: 'string', enum: [...ENTRANCE_ANIMATIONS] },
      exit: { type: 'string', enum: [...EXIT_ANIMATIONS] },
      showLogo: { type: 'boolean' },
      volume: { type: 'number' },
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
- Match the described mood with entrance, exit and per-element animation.
  glitch and wipe read as aggressive; fade and scale read as calm.
- volume is 0 to 1. Use 0.6 unless the description asks for loud or quiet.
- The label text should be short and upper case.`

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
