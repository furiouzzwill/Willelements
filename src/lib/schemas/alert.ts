import { z } from 'zod'

import { EVENT_TYPES } from '@/lib/schemas/event'

/**
 * The structured alert specification.
 *
 * This is what AI generates and what the browser runtime renders — a validated
 * description, never executable code. The element list is a closed set, so an
 * unrecognised element is rejected rather than passed through and hoped for.
 *
 * See docs/ai-generation.md for why this boundary exists.
 */

export const ENTRANCE_ANIMATIONS = [
  'fade',
  'scale',
  'slide-up',
  'slide-down',
  'glitch',
  'wipe',
] as const

export const EXIT_ANIMATIONS = ['fade', 'scale', 'slide-up', 'slide-down'] as const

export const ELEMENT_ANIMATIONS = [
  'none',
  'fade',
  'scale',
  'word-reveal',
  'typewriter',
] as const

export const alertElement = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('logo'),
    animation: z.enum(ELEMENT_ANIMATIONS).default('scale'),
  }),
  z.object({
    type: z.literal('label'),
    /** Static text, e.g. "NEW FOLLOWER". */
    value: z.string().max(60).default('NEW FOLLOWER'),
    animation: z.enum(ELEMENT_ANIMATIONS).default('word-reveal'),
  }),
  z.object({
    type: z.literal('username'),
    animation: z.enum(ELEMENT_ANIMATIONS).default('fade'),
  }),
  z.object({
    type: z.literal('message'),
    animation: z.enum(ELEMENT_ANIMATIONS).default('fade'),
  }),
  z.object({
    type: z.literal('amount'),
    animation: z.enum(ELEMENT_ANIMATIONS).default('scale'),
  }),
])

export type AlertElement = z.infer<typeof alertElement>

export const alertSpec = z.object({
  layout: z.enum(['centered', 'left', 'right', 'banner']).default('centered'),
  elements: z.array(alertElement).min(1).default([
    { type: 'label', value: 'NEW FOLLOWER', animation: 'word-reveal' },
    { type: 'username', animation: 'fade' },
  ]),
  entrance: z.enum(ENTRANCE_ANIMATIONS).default('fade'),
  exit: z.enum(EXIT_ANIMATIONS).default('fade'),
})

export type AlertSpec = z.infer<typeof alertSpec>

export function defaultAlertSpec(): AlertSpec {
  return alertSpec.parse({})
}

export const alertConfigInput = z.object({
  eventType: z.enum(EVENT_TYPES),
  spec: alertSpec.prefault({}),
  /**
   * Rendered with the event's values. `{{username}}` is always available;
   * `{{amount}}` and `{{message}}` depend on the event type.
   */
  messageTemplate: z.string().min(1).max(200).default('{{username}}'),
  durationMs: z.number().int().min(1000).max(30_000).default(5000),
  soundAssetId: z.string().nullish(),
  /** e.g. minimum bits for a cheer alert. Null means always fire. */
  minThreshold: z.number().int().positive().nullish(),
  enabled: z.boolean().default(true),
})

export type AlertConfigInput = z.infer<typeof alertConfigInput>

/** Fills a message template from an event. Unknown tokens are left untouched. */
export function renderTemplate(
  template: string,
  values: Record<string, string | number | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = values[key]
    return value === undefined ? match : String(value)
  })
}
