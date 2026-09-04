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
  /** Whether the brand logo appears above the text. */
  showLogo: z.boolean().default(true),
  /** Playback volume for the alert sound, if one is set. */
  volume: z.number().min(0).max(1).default(0.6),
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

/** The label shown above the username, per event type. */
export const DEFAULT_LABELS: Record<string, string> = {
  'channel.follow': 'NEW FOLLOWER',
  'channel.subscribe': 'NEW SUBSCRIBER',
  'channel.subscription.gift': 'GIFTED SUBS',
  'channel.raid': 'INCOMING RAID',
  'channel.cheer': 'CHEER',
  'stream.online': 'LIVE',
  'stream.offline': 'STREAM ENDED',
}

/** The message template a given event type starts with. */
export const DEFAULT_TEMPLATES: Record<string, string> = {
  'channel.follow': '{{username}}',
  'channel.subscribe': '{{username}}',
  'channel.subscription.gift': '{{username}} gifted {{total}} subs',
  'channel.raid': '{{username}} raided with {{viewers}}',
  'channel.cheer': '{{username}} cheered {{bits}} bits',
  'stream.online': 'Stream is live',
  'stream.offline': 'Stream ended',
}

/** Which template tokens are actually available for an event type. */
export const TEMPLATE_TOKENS: Record<string, string[]> = {
  'channel.follow': ['username'],
  'channel.subscribe': ['username', 'tier'],
  'channel.subscription.gift': ['username', 'total'],
  'channel.raid': ['username', 'viewers'],
  'channel.cheer': ['username', 'bits'],
  'stream.online': ['username'],
  'stream.offline': ['username'],
}

/** Event types where a minimum threshold makes sense. */
export const THRESHOLD_UNITS: Record<string, string> = {
  'channel.cheer': 'bits',
  'channel.raid': 'viewers',
  'channel.subscription.gift': 'subs',
}

/** The default spec for an event type, with its label already filled in. */
export function defaultSpecFor(eventType: string): AlertSpec {
  return alertSpec.parse({
    elements: [
      { type: 'label', value: DEFAULT_LABELS[eventType] ?? 'ALERT', animation: 'word-reveal' },
      { type: 'username', animation: 'fade' },
    ],
  })
}

/**
 * The values available to a message template for a given event.
 *
 * Only what the event actually carries — an unavailable token is left visible
 * as `{{bits}}` rather than rendering "undefined" on stream.
 */
export function templateValuesFor(event: {
  actor: { displayName: string }
  data: Record<string, unknown>
}): Record<string, string | number> {
  const values: Record<string, string | number> = { username: event.actor.displayName }

  for (const key of ['tier', 'total', 'viewers', 'bits'] as const) {
    const value = event.data[key]
    if (typeof value === 'string' || typeof value === 'number') values[key] = value
  }

  return values
}

/**
 * Whether an event clears its alert's minimum threshold.
 *
 * A cheer alert set to 100 bits should stay quiet for a 50-bit cheer rather
 * than firing for everything.
 */
export function meetsThreshold(
  event: { type: string; data: Record<string, unknown> },
  minThreshold: number | null | undefined,
): boolean {
  if (!minThreshold) return true

  const field =
    event.type === 'channel.cheer'
      ? 'bits'
      : event.type === 'channel.raid'
        ? 'viewers'
        : event.type === 'channel.subscription.gift'
          ? 'total'
          : null

  if (!field) return true

  const amount = event.data[field]
  return typeof amount === 'number' ? amount >= minThreshold : true
}

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
