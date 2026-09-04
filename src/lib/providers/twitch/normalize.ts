import { z } from 'zod'

import { normalizedEvent, type NormalizedEvent } from '@/lib/schemas/event'

/**
 * Turns a Twitch EventSub payload into the app's own event shape.
 *
 * This is the only file that knows Twitch's vocabulary. Everything downstream —
 * the activity feed, the alert engine, the overlay — sees the neutral shape, so
 * adding YouTube later means writing a sibling of this file and nothing else.
 *
 * Field names verified against the official subscription-type reference.
 */

/** The envelope every notification arrives in. */
export const notificationMessage = z.object({
  metadata: z.object({
    message_id: z.string().min(1),
    message_type: z.string(),
    message_timestamp: z.string(),
    subscription_type: z.string(),
    subscription_version: z.string(),
  }),
  payload: z.object({
    subscription: z.object({ id: z.string(), type: z.string() }),
    event: z.record(z.string(), z.unknown()),
  }),
})

export type TwitchNotification = z.infer<typeof notificationMessage>

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Maps one notification, or returns null for a subscription type we do not
 * handle — an unrecognised type is skipped rather than stored half-understood.
 */
export function normalizeTwitchEvent(message: TwitchNotification): NormalizedEvent | null {
  const { metadata, payload } = message
  const event = payload.event
  const type = metadata.subscription_type

  /** Twitch's timestamp for the event itself, falling back to the message's. */
  const occurredAt =
    str(event.followed_at) ?? str(event.started_at) ?? metadata.message_timestamp

  const base = {
    provider: 'twitch' as const,
    // Twitch's own message id. Combined with the provider this is unique in the
    // database, so a redelivered message is rejected there rather than by
    // application state that dies with the process.
    providerEventId: metadata.message_id,
    occurredAt,
    isTest: false,
  }

  switch (type) {
    case 'channel.follow':
      return normalizedEvent.parse({
        ...base,
        type: 'channel.follow',
        actor: {
          id: str(event.user_id) ?? 'unknown',
          displayName: str(event.user_name) ?? str(event.user_login) ?? 'Someone',
        },
        data: {},
      })

    case 'channel.subscribe':
      return normalizedEvent.parse({
        ...base,
        type: 'channel.subscribe',
        actor: {
          id: str(event.user_id) ?? 'unknown',
          displayName: str(event.user_name) ?? str(event.user_login) ?? 'Someone',
        },
        data: { tier: str(event.tier) ?? undefined, isGift: event.is_gift === true },
      })

    case 'channel.subscription.gift':
      return normalizedEvent.parse({
        ...base,
        type: 'channel.subscription.gift',
        actor: {
          // A gift can be anonymous, and the payload omits the user entirely.
          id: str(event.user_id) ?? 'anonymous',
          displayName:
            event.is_anonymous === true
              ? 'Anonymous'
              : (str(event.user_name) ?? str(event.user_login) ?? 'Someone'),
        },
        data: { total: num(event.total) ?? undefined, tier: str(event.tier) ?? undefined },
      })

    case 'channel.raid':
      return normalizedEvent.parse({
        ...base,
        type: 'channel.raid',
        // The raider is the actor — the "to" fields are this channel.
        actor: {
          id: str(event.from_broadcaster_user_id) ?? 'unknown',
          displayName:
            str(event.from_broadcaster_user_name) ??
            str(event.from_broadcaster_user_login) ??
            'Someone',
        },
        data: { viewers: num(event.viewers) ?? undefined },
      })

    case 'channel.cheer':
      return normalizedEvent.parse({
        ...base,
        type: 'channel.cheer',
        actor: {
          id: str(event.user_id) ?? 'anonymous',
          displayName:
            event.is_anonymous === true
              ? 'Anonymous'
              : (str(event.user_name) ?? str(event.user_login) ?? 'Someone'),
        },
        data: {
          bits: num(event.bits) ?? undefined,
          message: str(event.message) ?? undefined,
        },
      })

    case 'stream.online':
      return normalizedEvent.parse({
        ...base,
        type: 'stream.online',
        actor: {
          id: str(event.broadcaster_user_id) ?? 'unknown',
          displayName: str(event.broadcaster_user_name) ?? 'Stream',
        },
        data: { streamType: str(event.type) ?? undefined },
      })

    case 'stream.offline':
      return normalizedEvent.parse({
        ...base,
        type: 'stream.offline',
        actor: {
          id: str(event.broadcaster_user_id) ?? 'unknown',
          displayName: str(event.broadcaster_user_name) ?? 'Stream',
        },
        data: {},
      })

    default:
      return null
  }
}
