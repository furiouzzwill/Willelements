import type { EventType, NormalizedEvent } from '@/lib/schemas/event'

/**
 * The live values widgets display.
 *
 * Seeded when the overlay page loads and then updated from the same event
 * stream that drives alerts — so a "latest follower" widget changes the moment
 * the alert plays, with no polling and no second connection.
 */
export type WidgetData = {
  latestFollower: string | null
  latestSubscriber: string | null
  followerCount: number | null
  recent: { label: string; name: string; at: string }[]
}

export const EMPTY_WIDGET_DATA: WidgetData = {
  latestFollower: null,
  latestSubscriber: null,
  followerCount: null,
  recent: [],
}

const LABELS: Partial<Record<EventType, string>> = {
  'channel.follow': 'Follow',
  'channel.subscribe': 'Sub',
  'channel.subscription.gift': 'Gift',
  'channel.raid': 'Raid',
  'channel.cheer': 'Cheer',
}

/**
 * Folds an event into the current widget values.
 *
 * Pure, so the same function serves the runtime and the tests. Test events are
 * applied too: someone checking their layout should see the widget react, and
 * the value is corrected by the next real event.
 */
export function applyEvent(data: WidgetData, event: NormalizedEvent): WidgetData {
  const label = LABELS[event.type]
  const next: WidgetData = {
    ...data,
    recent: label
      ? [
          { label, name: event.actor.displayName, at: event.occurredAt },
          ...data.recent,
        ].slice(0, 20)
      : data.recent,
  }

  switch (event.type) {
    case 'channel.follow':
      return {
        ...next,
        latestFollower: event.actor.displayName,
        // Only meaningful once a starting count came from Twitch.
        followerCount: next.followerCount === null ? null : next.followerCount + 1,
      }
    case 'channel.subscribe':
    case 'channel.subscription.gift':
      return { ...next, latestSubscriber: event.actor.displayName }
    default:
      return next
  }
}
