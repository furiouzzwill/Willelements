import { z } from 'zod'

/**
 * The provider-neutral internal event.
 *
 * Every provider event is normalized into this shape by an adapter before
 * anything else sees it. Downstream — activity feed, analytics, alert engine,
 * overlay — knows nothing about Twitch or YouTube vocabulary, which is what
 * stops the whole app from quietly becoming Twitch-specific.
 */

export const EVENT_TYPES = [
  'channel.follow',
  'channel.subscribe',
  'channel.subscription.gift',
  'channel.raid',
  'channel.cheer',
  'stream.online',
  'stream.offline',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export const eventActor = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  avatarUrl: z.url().nullish(),
})

/** Type-specific payload. Kept loose — each provider carries different extras. */
export const eventData = z.looseObject({
  /** channel.subscribe */
  tier: z.string().optional(),
  isGift: z.boolean().optional(),
  /** channel.subscription.gift */
  total: z.number().int().nonnegative().optional(),
  /** channel.raid */
  viewers: z.number().int().nonnegative().optional(),
  /** channel.cheer */
  bits: z.number().int().nonnegative().optional(),
  message: z.string().optional(),
})

export const normalizedEvent = z.object({
  type: z.enum(EVENT_TYPES),
  provider: z.enum(['twitch', 'youtube']),
  /**
   * The provider's own event identifier. Combined with `provider` this is
   * unique in the database, so a redelivered event is rejected there rather
   * than by application state that dies with the process.
   *
   * Test events generate their own, prefixed so they are never mistaken for
   * real ones.
   */
  providerEventId: z.string().min(1),
  occurredAt: z.iso.datetime(),
  actor: eventActor,
  data: eventData.prefault({}),
  isTest: z.boolean().default(false),
})

export type NormalizedEvent = z.infer<typeof normalizedEvent>
export type EventActor = z.infer<typeof eventActor>

/** Human-readable label for an event type, for the activity feed. */
export const EVENT_LABELS: Record<EventType, string> = {
  'channel.follow': 'Follow',
  'channel.subscribe': 'Subscription',
  'channel.subscription.gift': 'Gift subscription',
  'channel.raid': 'Raid',
  'channel.cheer': 'Cheer',
  'stream.online': 'Stream started',
  'stream.offline': 'Stream ended',
}
