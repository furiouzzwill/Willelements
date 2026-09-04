import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, before, describe } from 'node:test'

import { applyEvent, EMPTY_WIDGET_DATA } from '../src/components/widgets/widget-data.ts'
import { defaultConfigFor, widgetConfig } from '../src/lib/schemas/overlay.ts'

/** Widgets: storage, layering, config validation and live data. */

const workspace = mkdtempSync(path.join(tmpdir(), 'we-widgets-'))
process.env.WILLELEMENTS_DATA_DIR = workspace
process.env.APP_URL = 'http://localhost:3000'

type WidgetModule = typeof import('../src/lib/services/widget-service.ts')
type OverlayModule = typeof import('../src/lib/services/overlay-service.ts')

let widgets: WidgetModule
let overlays: OverlayModule
let overlayId: string

before(async () => {
  widgets = await import('../src/lib/services/widget-service.ts')
  overlays = await import('../src/lib/services/overlay-service.ts')

  overlayId = overlays.createOverlay({
    name: 'Editor test',
    canvasWidth: 1920,
    canvasHeight: 1080,
    settings: { previewBackground: 'transparent' },
  }).id
})

after(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('placing widgets', () => {
  test('a new widget stacks above everything already placed', () => {
    const first = widgets.addWidget(overlayId, 'text')
    const second = widgets.addWidget(overlayId, 'clock')

    assert.ok(second.zIndex > first.zIndex)
  })

  test('gets a sensible default size and a valid config', () => {
    const goal = widgets.addWidget(overlayId, 'follower-goal')

    assert.ok(goal.width > 0 && goal.height > 0)
    assert.equal(goal.config.type, 'follower-goal')
    if (goal.config.type === 'follower-goal') {
      assert.equal(goal.config.target, 100)
    }
  })

  test('refuses a type the runtime cannot render', () => {
    // Declared in the registry but not built — placing it would put an
    // invisible widget on someone's stream.
    assert.throws(() => widgets.addWidget(overlayId, 'chat'), /not a widget/)
  })

  test('lists back to front', () => {
    const ordered = widgets.listWidgets(overlayId)
    for (let i = 1; i < ordered.length; i++) {
      assert.ok(ordered[i - 1].zIndex <= ordered[i].zIndex)
    }
  })
})

describe('moving and sizing', () => {
  test('positions are stored as given, including off-canvas', () => {
    // A lower third often hangs off the edge; clamping would fight the user.
    const widget = widgets.addWidget(overlayId, 'text')
    const moved = widgets.updateWidget(widget.id, { x: -40, y: 1040 })

    assert.equal(moved.x, -40)
    assert.equal(moved.y, 1040)
  })

  test('a size below the minimum is clamped rather than stored', () => {
    const widget = widgets.addWidget(overlayId, 'text')
    const resized = widgets.updateWidget(widget.id, { width: 2, height: -50 })

    assert.equal(resized.width, 20)
    assert.equal(resized.height, 20)
  })

  test('fractional positions are rounded to whole pixels', () => {
    const widget = widgets.addWidget(overlayId, 'clock')
    const moved = widgets.updateWidget(widget.id, { x: 10.6, y: 20.2 })

    assert.equal(moved.x, 11)
    assert.equal(moved.y, 20)
  })
})

describe('config validation', () => {
  test('a partial update merges rather than replacing', () => {
    const widget = widgets.addWidget(overlayId, 'text')
    const updated = widgets.updateWidget(widget.id, { config: { value: 'Hello' } as never })

    assert.equal(updated.config.type, 'text')
    if (updated.config.type === 'text') {
      assert.equal(updated.config.value, 'Hello')
      assert.equal(updated.config.fontSize, 48, 'untouched fields survive')
    }
  })

  test('rejects a config that does not match its type', () => {
    const widget = widgets.addWidget(overlayId, 'clock')
    assert.throws(() =>
      widgets.updateWidget(widget.id, { config: { format: 'sundial' } as never }),
    )
  })

  test('the registry is closed — an unknown type cannot be smuggled in', () => {
    // This is the boundary that stops generated content becoming generated
    // behaviour when AI starts editing overlays.
    assert.equal(widgetConfig.safeParse({ type: 'iframe', src: 'http://x' }).success, false)
    assert.equal(widgetConfig.safeParse({ type: 'script' }).success, false)
  })

  test('every implemented type has a valid default config', async () => {
    const { IMPLEMENTED_WIDGET_TYPES } = await import('../src/lib/schemas/overlay.ts')

    for (const type of IMPLEMENTED_WIDGET_TYPES) {
      const config = defaultConfigFor(type)
      assert.equal(config.type, type)
      assert.equal(widgetConfig.safeParse(config).success, true)
    }
  })
})

describe('layering', () => {
  test('bringing forward swaps with the widget above', () => {
    const ordered = widgets.listWidgets(overlayId)
    const [lower, upper] = [ordered[0], ordered[1]]

    widgets.reorderWidget(lower.id, 'forward')
    const after = widgets.listWidgets(overlayId)

    assert.equal(after[0].id, upper.id)
    assert.equal(after[1].id, lower.id)
  })

  test('moving the frontmost forward does nothing', () => {
    const ordered = widgets.listWidgets(overlayId)
    const top = ordered[ordered.length - 1]

    widgets.reorderWidget(top.id, 'forward')
    const after = widgets.listWidgets(overlayId)

    assert.equal(after[after.length - 1].id, top.id)
  })

  test('duplicating offsets the copy so it is visibly distinct', () => {
    const source = widgets.addWidget(overlayId, 'text')
    const copy = widgets.duplicateWidget(source.id)!

    assert.notEqual(copy.id, source.id)
    assert.equal(copy.x, source.x + 24)
    assert.ok(copy.zIndex > source.zIndex)
    assert.equal(copy.locked, false)
  })
})

describe('deleting', () => {
  test('removes the widget and nothing else', () => {
    const before = widgets.listWidgets(overlayId).length
    const widget = widgets.addWidget(overlayId, 'clock')

    widgets.deleteWidget(widget.id)

    assert.equal(widgets.getWidget(widget.id), null)
    assert.equal(widgets.listWidgets(overlayId).length, before)
  })

  test('deleting the overlay takes its widgets with it', () => {
    const scratch = overlays.createOverlay({
      name: 'Temporary',
      canvasWidth: 1280,
      canvasHeight: 720,
      settings: { previewBackground: 'transparent' },
    })
    widgets.addWidget(scratch.id, 'text')

    overlays.deleteOverlay(scratch.id)

    assert.deepEqual(widgets.listWidgets(scratch.id), [])
  })
})

describe('live widget data', () => {
  test('a follow updates the latest follower and the recent list', () => {
    const next = applyEvent(EMPTY_WIDGET_DATA, {
      type: 'channel.follow',
      provider: 'twitch',
      providerEventId: 'e1',
      occurredAt: new Date().toISOString(),
      actor: { id: '1', displayName: 'PixelWraith' },
      data: {},
      isTest: false,
    })

    assert.equal(next.latestFollower, 'PixelWraith')
    assert.equal(next.recent[0].name, 'PixelWraith')
    assert.equal(next.recent[0].label, 'Follow')
  })

  test('the follower count only moves once Twitch has given us a starting number', () => {
    // Incrementing from null would invent a total nobody supplied.
    const follow = {
      type: 'channel.follow' as const,
      provider: 'twitch' as const,
      providerEventId: 'e2',
      occurredAt: new Date().toISOString(),
      actor: { id: '1', displayName: 'A' },
      data: {},
      isTest: false,
    }

    assert.equal(applyEvent(EMPTY_WIDGET_DATA, follow).followerCount, null)
    assert.equal(
      applyEvent({ ...EMPTY_WIDGET_DATA, followerCount: 500 }, follow).followerCount,
      501,
    )
  })

  test('a subscription updates the subscriber, not the follower', () => {
    const next = applyEvent(
      { ...EMPTY_WIDGET_DATA, latestFollower: 'Existing' },
      {
        type: 'channel.subscribe',
        provider: 'twitch',
        providerEventId: 'e3',
        occurredAt: new Date().toISOString(),
        actor: { id: '2', displayName: 'SynthFox' },
        data: { tier: '1000' },
        isTest: false,
      },
    )

    assert.equal(next.latestSubscriber, 'SynthFox')
    assert.equal(next.latestFollower, 'Existing')
  })

  test('the recent list is capped so it cannot grow without bound', () => {
    let data = EMPTY_WIDGET_DATA

    for (let i = 0; i < 40; i++) {
      data = applyEvent(data, {
        type: 'channel.follow',
        provider: 'twitch',
        providerEventId: `bulk-${i}`,
        occurredAt: new Date().toISOString(),
        actor: { id: String(i), displayName: `Viewer${i}` },
        data: {},
        isTest: false,
      })
    }

    assert.equal(data.recent.length, 20)
    assert.equal(data.recent[0].name, 'Viewer39', 'newest first')
  })

  test('stream online/offline do not appear in the recent list', () => {
    const next = applyEvent(EMPTY_WIDGET_DATA, {
      type: 'stream.online',
      provider: 'twitch',
      providerEventId: 'e4',
      occurredAt: new Date().toISOString(),
      actor: { id: '1', displayName: 'NightShift' },
      data: {},
      isTest: false,
    })

    assert.deepEqual(next.recent, [], 'the feed is about viewers, not stream state')
  })
})
