import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, afterEach, before, describe } from 'node:test'

/** Overlays, their tokens, and event delivery to connected sources. */

const workspace = mkdtempSync(path.join(tmpdir(), 'we-overlay-'))
process.env.WILLELEMENTS_DATA_DIR = workspace
process.env.APP_URL = 'http://localhost:3000'

type OverlayModule = typeof import('../src/lib/services/overlay-service.ts')
type BusModule = typeof import('../src/lib/events/bus.ts')
type TestEventModule = typeof import('../src/lib/services/test-event-service.ts')

let overlays: OverlayModule
let bus: BusModule
let testEvents: TestEventModule

before(async () => {
  overlays = await import('../src/lib/services/overlay-service.ts')
  bus = await import('../src/lib/events/bus.ts')
  testEvents = await import('../src/lib/services/test-event-service.ts')
})

after(() => {
  rmSync(workspace, { recursive: true, force: true })
})

function makeOverlay(name = 'Main') {
  return overlays.createOverlay({
    name,
    canvasWidth: 1920,
    canvasHeight: 1080,
    settings: { previewBackground: 'transparent' },
  })
}

describe('overlay tokens', () => {
  test('are opaque, and unrelated to the row id', () => {
    const overlay = makeOverlay()

    assert.match(overlay.publicToken, /^[0-9a-f]{32}$/, '128 bits of hex')
    assert.notEqual(overlay.publicToken, overlay.id)
    assert.ok(
      !overlay.publicToken.includes(overlay.id.replace(/-/g, '').slice(0, 8)),
      'the token must not be derived from the id',
    )
  })

  test('two overlays never share a token', () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 25; i++) tokens.add(makeOverlay(`Overlay ${i}`).publicToken)

    assert.equal(tokens.size, 25)
  })

  test('the browser-source URL contains the token and nothing else identifying', () => {
    const overlay = makeOverlay('URL test')
    const url = overlays.browserSourceUrl(overlay)

    assert.equal(url, `http://localhost:3000/overlay/${overlay.publicToken}`)
    assert.ok(!url.includes(overlay.id), 'the row id must not appear in the URL')
  })

  test('rotating issues a new token and revokes the old one immediately', () => {
    const overlay = makeOverlay('Rotate me')
    const original = overlay.publicToken

    assert.ok(overlays.getOverlayByToken(original), 'resolves before rotation')

    const rotated = overlays.rotateOverlayToken(overlay.id)

    assert.notEqual(rotated, original)
    assert.equal(overlays.getOverlayByToken(original), null, 'the old URL stops working')
    assert.equal(overlays.getOverlayByToken(rotated)?.id, overlay.id)
  })

  test('a malformed token is rejected without reaching the database', () => {
    // Guards the one path where a URL segment becomes a query parameter.
    for (const bad of ['', 'nope', '../../etc/passwd', "' OR 1=1 --", 'A'.repeat(32)]) {
      assert.equal(overlays.getOverlayByToken(bad), null, `rejected: ${bad}`)
    }
  })
})

describe('overlay management', () => {
  test('rename trims and persists', () => {
    const overlay = makeOverlay('Before')
    overlays.renameOverlay(overlay.id, '  After  ')

    assert.equal(overlays.getOverlay(overlay.id)?.name, 'After')
  })

  test('rename rejects an empty name', () => {
    const overlay = makeOverlay('Keep me')
    assert.throws(() => overlays.renameOverlay(overlay.id, '   '))
    assert.equal(overlays.getOverlay(overlay.id)?.name, 'Keep me')
  })

  test('delete removes the overlay and its token', () => {
    const overlay = makeOverlay('Temporary')
    const token = overlay.publicToken

    overlays.deleteOverlay(overlay.id)

    assert.equal(overlays.getOverlay(overlay.id), null)
    assert.equal(overlays.getOverlayByToken(token), null)
  })
})

describe('event delivery', () => {
  const cleanups: (() => void)[] = []

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup()
  })

  function connect(overlayId: string) {
    const received: unknown[] = []
    cleanups.push(bus.subscribe({ overlayId, send: (message) => received.push(message) }))
    return received
  }

  test('an event reaches only the overlay it was addressed to', () => {
    const a = makeOverlay('A')
    const b = makeOverlay('B')

    const toA = connect(a.id)
    const toB = connect(b.id)

    const delivered = testEvents.sendTestEvent('channel.follow', a.id)

    assert.equal(delivered, 1)
    assert.equal(toA.length, 1)
    assert.equal(toB.length, 0, 'other overlays must not receive it')
  })

  test('every connection to one overlay receives it', () => {
    // OBS in two scenes, plus the dashboard preview — all legitimate listeners.
    const overlay = makeOverlay('Multi')
    const first = connect(overlay.id)
    const second = connect(overlay.id)

    const delivered = testEvents.sendTestEvent('channel.raid', overlay.id)

    assert.equal(delivered, 2)
    assert.equal(first.length, 1)
    assert.equal(second.length, 1)
  })

  test('reports zero when nothing is listening', () => {
    // This is what lets the UI say "open it in OBS" instead of appearing to work.
    const overlay = makeOverlay('Nobody home')
    assert.equal(testEvents.sendTestEvent('channel.follow', overlay.id), 0)
  })

  test('disconnecting stops delivery', () => {
    const overlay = makeOverlay('Leaving')
    const received: unknown[] = []
    const unsubscribe = bus.subscribe({
      overlayId: overlay.id,
      send: (m) => received.push(m),
    })

    testEvents.sendTestEvent('channel.follow', overlay.id)
    assert.equal(received.length, 1)

    unsubscribe()
    testEvents.sendTestEvent('channel.follow', overlay.id)
    assert.equal(received.length, 1, 'no delivery after disconnect')
  })

  test('one broken source does not stop delivery to the others', () => {
    const overlay = makeOverlay('Resilient')
    const healthy: unknown[] = []

    cleanups.push(
      bus.subscribe({
        overlayId: overlay.id,
        send: () => {
          throw new Error('this source is wedged')
        },
      }),
    )
    cleanups.push(bus.subscribe({ overlayId: overlay.id, send: (m) => healthy.push(m) }))

    const delivered = testEvents.sendTestEvent('channel.follow', overlay.id)

    assert.equal(healthy.length, 1, 'the working source still got it')
    assert.equal(delivered, 1, 'and the broken one was not counted')
    assert.equal(
      bus.connectionCount(overlay.id),
      1,
      'the broken source is dropped rather than retried forever',
    )
  })
})

describe('test events', () => {
  test('are flagged and prefixed so they can never pass as real', () => {
    const event = testEvents.buildTestEvent('channel.follow')

    assert.equal(event.isTest, true)
    assert.match(event.providerEventId, /^test-/)
  })

  test('carry type-appropriate data', () => {
    const raid = testEvents.buildTestEvent('channel.raid')
    assert.equal(typeof (raid.data as { viewers?: number }).viewers, 'number')

    const cheer = testEvents.buildTestEvent('channel.cheer')
    assert.equal(typeof (cheer.data as { bits?: number }).bits, 'number')
  })

  test('validate against the same schema as real events', () => {
    // The point of a test event: it travels the real pipeline, not a mock of it.
    for (const type of ['channel.follow', 'channel.subscribe', 'channel.raid'] as const) {
      const event = testEvents.buildTestEvent(type)
      assert.equal(event.provider, 'twitch')
      assert.ok(Date.parse(event.occurredAt) > 0)
      assert.ok(event.actor.displayName.length > 0)
    }
  })
})
