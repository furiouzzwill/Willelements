import 'server-only'

import { randomUUID } from 'node:crypto'

import { getDb } from '@/lib/db'
import { aiCommands } from '@/lib/db/schema'
import { generateStructured, TextProviderError } from '@/lib/providers/openai/text'
import { tokensToCost, TEXT_MODEL } from '@/lib/providers/openai/pricing'
import { composition, screenComposition, type Composition } from '@/lib/schemas/composition'
import { EVENT_LABELS, type EventType } from '@/lib/schemas/event'
import { getDefaultBrand } from '@/lib/services/brand-service'

/**
 * Generating a real composition — markup, styles and script.
 *
 * The counterpart to `alert-design-service`, which composes a timeline inside a
 * closed vocabulary. This one writes code, which is more expressive and
 * genuinely riskier, and the difference is contained by where it runs rather
 * than by what it is allowed to say. See `schemas/composition.ts` for the whole
 * argument and what was traded away.
 *
 * Nothing generated here executes on the server. The service produces a string,
 * screens it, and hands it to a sandboxed frame in the browser.
 */

export class CompositionError extends Error {}

const SYSTEM = `You write self-contained animated overlays for a live stream.

You return the complete contents of a <body>: markup, one <style> and one
<script>. It is rendered inside an isolated frame, 1920x1080, on a transparent
background over live gameplay.

Available to you:
- CSS variables already defined: --primary, --secondary, --accent, --background,
  --text, --heading-font, --body-font. Use them; do not invent colours.
- Placeholders substituted before rendering: {{username}}, {{amount}},
  {{message}}, {{label}}, {{logo}}. {{logo}} is a URL or empty — always guard it.

Hard constraints, because of where this runs:
- No network of any kind. No fetch, no XMLHttpRequest, no WebSocket, no remote
  scripts, fonts, images or stylesheets. Nothing is available to load. Draw
  everything yourself with CSS and DOM.
- No external libraries. There is no GSAP, no jQuery, nothing. Use CSS
  animations and, where you need more, requestAnimationFrame.
- No unbounded loops. Every animation must finish and settle.
- No storage, no cookies, no navigation, no nested frames.
- Do not reference window.parent, window.top or window.opener. They are blocked
  and the attempt will be rejected.

Make it good:
- The alert must be READABLE. The username is the point — large, high contrast,
  with a shadow or a plate behind it so it survives over any footage.
- Animate with transform and opacity wherever you can; they are the cheap ones,
  and this shares a machine with a video encoder.
- Finish within about two seconds and hold, then let the app remove it.
- Centre the composition. It is placed over the middle of the canvas.
- This is where you can do what a constrained animation system cannot: particle
  systems, canvas drawing, SVG filters and masks, staggered per-character text,
  3D transforms, gradient meshes. Use that freedom — a plain fade is a wasted
  opportunity here.`

export type CompositionRequest = {
  eventType: EventType
  description: string
  /**
   * The composition being changed, when this is a revision.
   *
   * Iteration is the whole difference between a generator and something you
   * can actually work with. Without it, "make the particles bigger" has to be
   * a complete re-description, and the result is a different alert rather than
   * the same one adjusted.
   */
  previous?: { html: string; summary: string }
}

export type CompositionResult = {
  composition: Composition
  costEstimate: number | null
  /** Anything the screen flagged. Non-empty means it was rejected. */
  issues: string[]
}

function jsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['html', 'summary', 'durationMs'],
    properties: {
      html: {
        type: 'string',
        description:
          'The complete body: markup, one <style>, one <script>. No <html>, <head> or <body> tags.',
      },
      summary: { type: 'string', description: 'One sentence on what you built.' },
      durationMs: {
        type: 'integer',
        description: 'How long it needs on screen, 500 to 15000.',
      },
    },
  }
}

export async function generateComposition(
  request: CompositionRequest,
): Promise<CompositionResult> {
  const description = request.description.trim()
  if (!description) throw new CompositionError('Describe the alert you want.')

  const brand = getDefaultBrand()
  if (!brand) throw new CompositionError('No brand to design against.')

  const { colors, visualStyle, personality } = brand.dna

  const context = [
    `Event: ${EVENT_LABELS[request.eventType]} (${request.eventType}).`,
    `Brand style: ${visualStyle.style}, ${visualStyle.detail} detail, ${visualStyle.canvas} canvas.`,
    personality.length ? `Brand character: ${personality.join(', ')}.` : '',
    `Palette, already available as CSS variables: primary ${colors.primary}, ` +
      `secondary ${colors.secondary}, accent ${colors.accent}, text ${colors.text}.`,
  ].filter(Boolean)

  // A revision carries the current composition, so a change is a change rather
  // than a fresh attempt that happens to share a description.
  const user = request.previous
    ? [
        ...context,
        '',
        'You are REVISING an existing composition. Keep everything the request',
        'does not mention — the same structure, the same feel — and change only',
        'what is asked for. Return the complete revised composition, not a diff.',
        '',
        `What it currently does: ${request.previous.summary || '(no summary)'}`,
        '',
        'Current composition:',
        '```html',
        request.previous.html,
        '```',
        '',
        `The change: ${description}`,
      ].join('\n')
    : [...context, '', `Build this: ${description}`].join('\n')

  const common = {
    brandId: brand.id,
    kind: request.previous ? 'alert-composition-revision' : 'alert-composition',
    model: TEXT_MODEL,
    prompt: description,
    target: request.eventType,
  }

  try {
    const result = await generateStructured({
      model: TEXT_MODEL,
      system: SYSTEM,
      user,
      schema: jsonSchema(),
      schemaName: 'alert_composition',
    })

    const parsed = composition.safeParse(result.value)
    if (!parsed.success) {
      throw new CompositionError(
        `The composition came back in an unusable shape: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
      )
    }

    // Screened before anyone previews it. The sandbox is what actually
    // contains the code; this rejects the obviously wrong earlier and more
    // cheaply, and gives a reason worth reading.
    const issues = screenComposition(parsed.data.html).map((issue) => issue.reason)
    const costEstimate = tokensToCost(result.inputTokens, result.outputTokens)

    getDb()
      .insert(aiCommands)
      .values({
        id: randomUUID(),
        ...common,
        result: issues.length === 0 ? parsed.data : null,
        costEstimate,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        status: issues.length === 0 ? 'succeeded' : 'failed',
        error: issues.length > 0 ? `Rejected: ${issues.join(', ')}` : null,
      })
      .run()

    if (issues.length > 0) {
      throw new CompositionError(
        `That composition was rejected — it contained ${[...new Set(issues)].join(', ')}. Try describing it differently.`,
      )
    }

    return { composition: parsed.data, costEstimate, issues: [] }
  } catch (error) {
    const message =
      error instanceof TextProviderError || error instanceof CompositionError
        ? error.message
        : 'That composition could not be generated.'

    if (!(error instanceof CompositionError)) {
      getDb()
        .insert(aiCommands)
        .values({
          id: randomUUID(),
          ...common,
          result: null,
          costEstimate: null,
          status: 'failed',
          error: message,
        })
        .run()
    }

    throw error instanceof CompositionError ? error : new CompositionError(message)
  }
}
