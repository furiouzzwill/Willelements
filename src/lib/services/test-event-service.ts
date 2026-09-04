import 'server-only'

import { randomUUID } from 'node:crypto'

import { normalizedEvent, type EventType, type NormalizedEvent } from '@/lib/schemas/event'
import { recordEvent } from '@/lib/services/event-service'

/**
 * Simulated events for previewing a setup.
 *
 * A test event enters the pipeline in exactly the same shape as a real one and
 * travels the same path — same normalization, same queue, same browser source.
 * Testing a mock of the alert pipeline would tell you nothing about the alert
 * pipeline.
 *
 * They carry `isTest: true` and a prefixed id, so they can never be mistaken
 * for real events or counted in analytics.
 */

const NAMES = [
  'NightOwl_92',
  'PixelWraith',
  'QuietStorm',
  'VoidRunner',
  'EmberKate',
  'SynthFox',
]

function sampleData(type: EventType): Record<string, unknown> {
  switch (type) {
    case 'channel.raid':
      return { viewers: 20 + Math.floor(Math.random() * 400) }
    case 'channel.cheer':
      return { bits: 100 * (1 + Math.floor(Math.random() * 20)) }
    case 'channel.subscribe':
      return { tier: '1000' }
    case 'channel.subscription.gift':
      return { total: 1 + Math.floor(Math.random() * 10) }
    default:
      return {}
  }
}

export function buildTestEvent(type: EventType): NormalizedEvent {
  const name = NAMES[Math.floor(Math.random() * NAMES.length)]

  return normalizedEvent.parse({
    type,
    provider: 'twitch',
    // Prefixed and unique, so a test can never collide with or be mistaken for
    // a real provider event.
    providerEventId: `test-${randomUUID()}`,
    occurredAt: new Date().toISOString(),
    actor: { id: `test-${name}`, displayName: name },
    data: sampleData(type),
    isTest: true,
  })
}

/**
 * Fires a test event. Returns how many overlay connections received it.
 *
 * Goes through `recordEvent`, the same door a real Twitch event comes through —
 * so it is persisted, deduplicated and fanned out identically. Publishing
 * straight to the bus would have made the test exercise less than it claims,
 * and the whole point of a test event is that a passing test means the real
 * path works.
 *
 * It is stored with `isTest: true`, so it never pollutes the activity feed or
 * counts as real activity.
 */
export function sendTestEvent(type: EventType): number {
  return recordEvent(buildTestEvent(type)).delivered
}
