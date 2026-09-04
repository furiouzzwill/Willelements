import assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import { normalizeTwitchEvent } from '../src/lib/providers/twitch/normalize.ts'
import {
  ALL_SCOPES,
  conditionFor,
  missingScopes,
  SUBSCRIPTIONS,
  subscriptionsFor,
} from '../src/lib/providers/twitch/subscriptions.ts'

/**
 * Turning Twitch payloads into the app's own event shape.
 *
 * These payloads mirror the field names in Twitch's subscription-type
 * reference. This is the one file that knows Twitch's vocabulary, so it is the
 * one worth pinning down.
 */

function notification(type: string, event: Record<string, unknown>, messageId = 'msg-1') {
  return {
    metadata: {
      message_id: messageId,
      message_type: 'notification',
      message_timestamp: '2026-01-01T12:00:00.000Z',
      subscription_type: type,
      subscription_version: '1',
    },
    payload: {
      subscription: { id: 'sub-1', type },
      event,
    },
  }
}

describe('normalizing follows', () => {
  test('maps the follower as the actor and keeps Twitch\'s own timestamp', () => {
    const result = normalizeTwitchEvent(
      notification('channel.follow', {
        user_id: '123',
        user_login: 'pixelwraith',
        user_name: 'PixelWraith',
        followed_at: '2026-01-01T11:59:00.000Z',
      }),
    )!

    assert.equal(result.type, 'channel.follow')
    assert.equal(result.provider, 'twitch')
    assert.equal(result.actor.id, '123')
    assert.equal(result.actor.displayName, 'PixelWraith')
    assert.equal(result.occurredAt, '2026-01-01T11:59:00.000Z', 'not the message time')
    assert.equal(result.isTest, false)
  })

  test('uses the message id as the deduplication key', () => {
    const result = normalizeTwitchEvent(
      notification('channel.follow', { user_id: '1', user_name: 'A' }, 'unique-message-id'),
    )!

    assert.equal(result.providerEventId, 'unique-message-id')
  })

  test('falls back to the login, then to a placeholder, rather than rendering blank', () => {
    const noName = normalizeTwitchEvent(
      notification('channel.follow', { user_id: '1', user_login: 'lowercase' }),
    )!
    assert.equal(noName.actor.displayName, 'lowercase')

    const nothing = normalizeTwitchEvent(notification('channel.follow', {}))!
    assert.equal(nothing.actor.displayName, 'Someone')
  })
})

describe('normalizing raids', () => {
  test('the raider is the actor, not the channel being raided', () => {
    const result = normalizeTwitchEvent(
      notification('channel.raid', {
        from_broadcaster_user_id: '99',
        from_broadcaster_user_name: 'BigStreamer',
        to_broadcaster_user_id: '1',
        to_broadcaster_user_name: 'Me',
        viewers: 250,
      }),
    )!

    assert.equal(result.actor.displayName, 'BigStreamer', 'the "to" side is us')
    assert.equal(result.actor.id, '99')
    assert.equal(result.data.viewers, 250)
  })
})

describe('normalizing cheers and gifts', () => {
  test('an anonymous cheer is labelled rather than showing an empty name', () => {
    const result = normalizeTwitchEvent(
      notification('channel.cheer', { is_anonymous: true, bits: 500, message: 'nice' }),
    )!

    assert.equal(result.actor.displayName, 'Anonymous')
    assert.equal(result.data.bits, 500)
    assert.equal(result.data.message, 'nice')
  })

  test('a named cheer keeps the name', () => {
    const result = normalizeTwitchEvent(
      notification('channel.cheer', {
        is_anonymous: false,
        user_id: '7',
        user_name: 'SynthFox',
        bits: 100,
      }),
    )!

    assert.equal(result.actor.displayName, 'SynthFox')
  })

  test('gift subs carry the total', () => {
    const result = normalizeTwitchEvent(
      notification('channel.subscription.gift', {
        user_id: '5',
        user_name: 'Generous',
        total: 10,
        tier: '1000',
      }),
    )!

    assert.equal(result.data.total, 10)
    assert.equal(result.data.tier, '1000')
  })
})

describe('normalizing stream state', () => {
  test('stream.online uses the stream start time', () => {
    const result = normalizeTwitchEvent(
      notification('stream.online', {
        broadcaster_user_id: '1',
        broadcaster_user_name: 'NightShift',
        type: 'live',
        started_at: '2026-01-01T10:00:00.000Z',
      }),
    )!

    assert.equal(result.type, 'stream.online')
    assert.equal(result.occurredAt, '2026-01-01T10:00:00.000Z')
  })
})

describe('unknown types', () => {
  test('are skipped rather than stored half-understood', () => {
    assert.equal(normalizeTwitchEvent(notification('channel.something.new', {})), null)
  })
})

describe('subscription definitions', () => {
  test('channel.follow is version 2 with both condition fields', () => {
    // v1 was deprecated and v2 added the moderator requirement. Getting this
    // wrong means the subscription is simply refused.
    const follow = SUBSCRIPTIONS.find((s) => s.type === 'channel.follow')!

    assert.equal(follow.version, '2')
    assert.equal(follow.scope, 'moderator:read:followers')
    assert.deepEqual(conditionFor(follow, '42'), {
      broadcaster_user_id: '42',
      moderator_user_id: '42',
    })
  })

  test('raids subscribe to incoming, not outgoing', () => {
    const raid = SUBSCRIPTIONS.find((s) => s.type === 'channel.raid')!

    assert.deepEqual(conditionFor(raid, '42'), { to_broadcaster_user_id: '42' })
    assert.ok(
      !('from_broadcaster_user_id' in conditionFor(raid, '42')),
      'setting the from side would subscribe to raids we send out',
    )
  })

  test('a token with only the follower scope still gets the unscoped events', () => {
    const allowed = subscriptionsFor(['moderator:read:followers']).map((s) => s.eventType)

    assert.deepEqual(allowed.sort(), [
      'channel.follow',
      'channel.raid',
      'stream.offline',
      'stream.online',
    ])
  })

  test('and is told exactly what the rest would need', () => {
    const missing = missingScopes(['moderator:read:followers'])

    assert.deepEqual(
      missing.map((m) => m.scope).sort(),
      ['bits:read', 'channel:read:subscriptions', 'channel:read:subscriptions'],
    )
  })

  test('a fully-scoped token gets everything', () => {
    assert.equal(subscriptionsFor([...ALL_SCOPES]).length, SUBSCRIPTIONS.length)
    assert.deepEqual(missingScopes([...ALL_SCOPES]), [])
  })

  test('every subscription maps to an event type the app can render', async () => {
    const { EVENT_TYPES } = await import('../src/lib/schemas/event.ts')

    for (const definition of SUBSCRIPTIONS) {
      assert.ok(
        (EVENT_TYPES as readonly string[]).includes(definition.eventType),
        `${definition.eventType} is subscribed to but is not a known event type`,
      )
    }
  })
})
