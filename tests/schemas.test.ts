import assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import { brandDna, brandInput, defaultBrandDna } from '../src/lib/schemas/brand.ts'
import { alertSpec, renderTemplate } from '../src/lib/schemas/alert.ts'
import { normalizedEvent } from '../src/lib/schemas/event.ts'
import { widgetConfig } from '../src/lib/schemas/overlay.ts'
import { readJson, writeJson } from '../src/lib/db/json.ts'

describe('brand DNA', () => {
  test('fills every field from an empty object', () => {
    const dna = defaultBrandDna()

    assert.equal(dna.colors.primary, '#A855F7')
    assert.equal(dna.typography.heading, 'Space Grotesk')
    assert.equal(dna.visualStyle.canvas, 'dark')
    assert.deepEqual(dna.motionStyle.style, ['smooth'])
    assert.deepEqual(dna.rules.avoid, [])
  })

  test('keeps supplied values and defaults the rest', () => {
    const dna = brandDna.parse({ colors: { primary: '#112233' } })

    assert.equal(dna.colors.primary, '#112233')
    assert.equal(dna.colors.background, '#09090B', 'unspecified colours still default')
  })

  test('normalises hex colours to uppercase', () => {
    const dna = brandDna.parse({ colors: { primary: '#aabbcc' } })
    assert.equal(dna.colors.primary, '#AABBCC')
  })

  test('rejects a malformed colour', () => {
    assert.equal(brandDna.safeParse({ colors: { primary: 'purple' } }).success, false)
    assert.equal(brandDna.safeParse({ colors: { primary: '#FFF' } }).success, false)
  })

  test('requires a brand name', () => {
    assert.equal(brandInput.safeParse({ name: '   ' }).success, false)
    assert.equal(brandInput.safeParse({ name: 'NightShift' }).success, true)
  })
})

describe('JSON column helpers', () => {
  test('a corrupt stored value reads back as defaults rather than throwing', () => {
    // Simulates a column edited by hand, or written by an older version.
    const warnings: unknown[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => warnings.push(args)

    try {
      const dna = readJson(brandDna, { colors: { primary: 'not-a-colour' } }, 'test')
      assert.equal(dna.colors.primary, '#A855F7', 'falls back to the default palette')
      assert.equal(warnings.length, 1, 'and says so')
    } finally {
      console.warn = originalWarn
    }
  })

  test('writes are strict — bad data never reaches the database', () => {
    assert.throws(() => writeJson(brandDna, { colors: { primary: 'nope' } }))
  })
})

describe('alert spec', () => {
  test('defaults to a follower-shaped alert', () => {
    const spec = alertSpec.parse({})

    assert.equal(spec.layout, 'centered')
    assert.equal(spec.entrance, 'fade')
    assert.equal(spec.elements.length, 2)
    assert.equal(spec.elements[0].type, 'label')
  })

  test('rejects an element type that is not in the registry', () => {
    const result = alertSpec.safeParse({
      elements: [{ type: 'arbitrary-html', value: '<script>' }],
    })
    assert.equal(result.success, false, 'unknown elements must not pass through')
  })

  test('rejects an empty element list', () => {
    assert.equal(alertSpec.safeParse({ elements: [] }).success, false)
  })
})

describe('message templates', () => {
  test('substitutes known tokens', () => {
    assert.equal(
      renderTemplate('{{username}} just followed!', { username: 'Ada' }),
      'Ada just followed!',
    )
  })

  test('leaves unknown tokens alone rather than printing undefined', () => {
    assert.equal(renderTemplate('{{username}} gave {{bits}}', { username: 'Ada' }), 'Ada gave {{bits}}')
  })

  test('handles numeric values', () => {
    assert.equal(renderTemplate('{{viewers}} raiders', { viewers: 42 }), '42 raiders')
  })
})

describe('normalized events', () => {
  test('accepts a follow event and defaults isTest to false', () => {
    const event = normalizedEvent.parse({
      type: 'channel.follow',
      provider: 'twitch',
      providerEventId: 'evt-1',
      occurredAt: '2026-01-01T00:00:00.000Z',
      actor: { id: '123', displayName: 'Ada' },
    })

    assert.equal(event.isTest, false)
    assert.deepEqual(event.data, {})
  })

  test('rejects an event type the app does not handle', () => {
    const result = normalizedEvent.safeParse({
      type: 'channel.unknown',
      provider: 'twitch',
      providerEventId: 'evt-2',
      occurredAt: '2026-01-01T00:00:00.000Z',
      actor: { id: '1', displayName: 'A' },
    })
    assert.equal(result.success, false)
  })

  test('rejects a non-ISO timestamp', () => {
    const result = normalizedEvent.safeParse({
      type: 'channel.follow',
      provider: 'twitch',
      providerEventId: 'evt-3',
      occurredAt: 'last tuesday',
      actor: { id: '1', displayName: 'A' },
    })
    assert.equal(result.success, false)
  })
})

describe('widget config', () => {
  test('defaults a text widget', () => {
    const widget = widgetConfig.parse({ type: 'text' })
    assert.equal(widget.type, 'text')
    if (widget.type === 'text') {
      assert.equal(widget.fontSize, 48)
      assert.equal(widget.align, 'left')
    }
  })

  test('rejects an unregistered widget type', () => {
    assert.equal(widgetConfig.safeParse({ type: 'iframe', src: 'http://x' }).success, false)
  })
})
