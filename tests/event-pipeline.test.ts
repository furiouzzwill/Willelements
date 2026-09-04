import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, afterEach, before, describe } from 'node:test'

/**
 * The whole path a real Twitch event takes:
 *
 *   Twitch payload → normalize → record → dedupe → publish → overlay
 *
 * This is the pipeline the entire project exists to make work, so it is tested
 * as one piece rather than only in parts.
 */

const workspace = mkdtempSync(path.join(tmpdir(), 'we-pipeline-'))
process.env.WILLELEMENTS_DATA_DIR = workspace

type EventModule = typeof import('../src/lib/services/event-service.ts')
type BusModule = typeof import('../src/lib/events/bus.ts')

let events: EventModule
let bus: BusModule
let normalize: typeof import('../src/lib/providers/twitch/normalize.ts').normalizeTwitchEvent

before(async () => {
  events = await import('../src/lib/services/event-service.ts')
  bus = await import('../src/lib/events/bus.ts')
  normalize = (await import('../src/lib/providers/twitch/normalize.ts')).normalizeTwitchEvent
})

after(() => {
  rmSync(workspace, { recursive: true, force: true })
})

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

function connectOverlay(overlayId = 'overlay-1') {
  const received: unknown[] = []
  cleanups.push(bus.subscribe({ overlayId, send: (message) => received.push(message) }))
  return received
}

function twitchFollow(messageId: string, name = 'PixelWraith') {
  return {
    metadata: {
      message_id: messageId,
      message_type: 'notification',
      message_timestamp: new Date().toISOString(),
      subscription_type: 'channel.follow',
      subscription_version: '2',
    },
    payload: {
      subscription: { id: 'sub-1', type: 'channel.follow' },
      event: {
        user_id: '123',
        user_login: name.toLowerCase(),
        user_name: name,
        followed_at: new Date().toISOString(),
      },
    },
  }
}

describe('a real follow, end to end', () => {
  test('reaches a connected overlay and is recorded', () => {
    const overlay = connectOverlay()

    const event = normalize(twitchFollow('msg-live-1'))!
    const result = events.recordEvent(event)

    assert.equal(result.isNew, true)
    assert.equal(result.delivered, 1, 'the overlay received it')
    assert.equal(overlay.length, 1)

    const feed = events.listActivity()
    assert.equal(feed[0].type, 'channel.follow')
    assert.equal(feed[0].actorName, 'PixelWraith')
    assert.equal(feed[0].isTest, false)
  })

  test('a redelivered message is dropped, not replayed', () => {
    // Replaying an alert for a follow that already fired is worse than dropping
    // it, and the unique constraint is what makes that a guarantee rather than
    // a hope.
    const overlay = connectOverlay()
    const before = events.countEvents()

    const event = normalize(twitchFollow('msg-live-1'))!
    const result = events.recordEvent(event)

    assert.equal(result.isNew, false)
    assert.equal(result.delivered, 0, 'no alert fires for a duplicate')
    assert.equal(overlay.length, 0)
    assert.equal(events.countEvents(), before, 'and nothing is stored twice')
  })

  test('a different message for the same follower is a separate event', () => {
    const event = normalize(twitchFollow('msg-live-2', 'PixelWraith'))!
    assert.equal(events.recordEvent(event).isNew, true)
  })
})

describe('the activity feed', () => {
  test('hides test events by default so real activity is legible', () => {
    const testEvent = normalize(twitchFollow('msg-test-1', 'TestPerson'))!
    events.recordEvent({ ...testEvent, isTest: true })

    const real = events.listActivity()
    const all = events.listActivity({ includeTests: true })

    assert.ok(!real.some((entry) => entry.actorName === 'TestPerson'))
    assert.ok(all.some((entry) => entry.actorName === 'TestPerson'))
  })

  test('counts exclude tests', () => {
    assert.equal(
      events.countEvents({ includeTests: true }) > events.countEvents(),
      true,
      'the test event is stored but not counted as real activity',
    )
  })

  test('is ordered newest first', () => {
    const feed = events.listActivity({ includeTests: true })
    const times = feed.map((entry) => Date.parse(entry.occurredAt))

    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i - 1] >= times[i], 'newest first')
    }
  })

  test('latest-of-type ignores tests', () => {
    const latest = events.latestEventOfType('channel.follow')
    assert.ok(latest)
    assert.notEqual(latest.actorName, 'TestPerson')
  })
})

describe('event delivery and alert eligibility', () => {
  test('a raid carries its viewer count through to the overlay', () => {
    const overlay = connectOverlay()

    const raid = normalize({
      metadata: {
        message_id: 'msg-raid-1',
        message_type: 'notification',
        message_timestamp: new Date().toISOString(),
        subscription_type: 'channel.raid',
        subscription_version: '1',
      },
      payload: {
        subscription: { id: 's', type: 'channel.raid' },
        event: {
          from_broadcaster_user_id: '9',
          from_broadcaster_user_name: 'BigStreamer',
          to_broadcaster_user_id: '1',
          viewers: 300,
        },
      },
    })!

    events.recordEvent(raid)

    const delivered = overlay[0] as { event: { data: { viewers: number } } }
    assert.equal(delivered.event.data.viewers, 300)
  })

  test('clearing history removes events but nothing else', () => {
    events.clearActivity()

    assert.equal(events.countEvents({ includeTests: true }), 0)
    assert.deepEqual(events.listActivity({ includeTests: true }), [])
  })
})
