import 'server-only'

import { randomUUID } from 'node:crypto'

import { publish } from '@/lib/events/bus'
import { normalizedEvent, type EventType, type NormalizedEvent } from '@/lib/schemas/event'

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

/** Fires a test event at one overlay. Returns how many connections received it. */
export function sendTestEvent(type: EventType, overlayId: string): number {
  return publish(buildTestEvent(type), overlayId)
}
