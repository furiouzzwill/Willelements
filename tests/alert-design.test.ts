import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, before, describe } from 'node:test'

/**
 * Designing an alert from a description.
 *
 * The thing worth protecting here is the boundary `docs/ai-generation.md`
 * draws: a model returns a **specification**, and the closed element set is
 * what stops that from becoming "run whatever came back". These tests check the
 * gate holds against the shapes a model actually produces when it goes wrong —
 * an invented animation, an unknown element type, an extra field — rather than
 * only against well-formed input.
 */

const workspace = mkdtempSync(path.join(tmpdir(), 'we-design-'))
process.env.WILLELEMENTS_DATA_DIR = workspace

type Design = typeof import('../src/lib/services/alert-design-service.ts')
type Alert = typeof import('../src/lib/schemas/alert.ts')
type Pricing = typeof import('../src/lib/providers/openai/pricing.ts')

let design: Design
let alert: Alert
let pricing: Pricing

before(async () => {
  design = await import('../src/lib/services/alert-design-service.ts')
  alert = await import('../src/lib/schemas/alert.ts')
  pricing = await import('../src/lib/providers/openai/pricing.ts')
})

after(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('the schema handed to the provider', () => {
  test('is built from the same constants the renderer uses', () => {
    const schema = design.buildAlertJsonSchema() as {
      properties: {
        entrance: { enum: string[] }
        exit: { enum: string[] }
      }
    }

    // Hand-writing these would let the app grow an animation the model is never
    // offered, or offer one that cannot be rendered.
    assert.deepEqual(schema.properties.entrance.enum, [...alert.ENTRANCE_ANIMATIONS])
    assert.deepEqual(schema.properties.exit.enum, [...alert.EXIT_ANIMATIONS])
  })

  test('closes every object, so an invented field cannot ride along', () => {
    const schema = design.buildAlertJsonSchema() as Record<string, unknown>
    assert.equal(schema.additionalProperties, false)

    const items = (schema.properties as Record<string, { items?: { anyOf?: unknown[] } }>).elements
      .items
    for (const variant of items?.anyOf ?? []) {
      assert.equal((variant as Record<string, unknown>).additionalProperties, false)
    }
  })

  test('offers exactly the five element types the renderer knows', () => {
    const schema = design.buildAlertJsonSchema() as Record<string, unknown>
    const items = (schema.properties as Record<string, { items?: { anyOf?: unknown[] } }>).elements
      .items

    const types = (items?.anyOf ?? []).map(
      (variant) =>
        ((variant as { properties: { type: { enum: string[] } } }).properties.type.enum ?? [])[0],
    )

    assert.deepEqual(types, ['logo', 'label', 'username', 'message', 'amount'])
  })
})

describe('the validation gate', () => {
  test('accepts a well-formed spec', () => {
    const parsed = alert.alertSpec.safeParse({
      layout: 'centered',
      elements: [
        { type: 'label', value: 'NEW FOLLOWER', animation: 'word-reveal' },
        { type: 'username', animation: 'fade' },
      ],
      entrance: 'glitch',
      exit: 'fade',
      showLogo: true,
      volume: 0.6,
    })

    assert.equal(parsed.success, true)
  })

  test('rejects an element type that is not in the registry', () => {
    // The failure this exists to prevent: a model inventing "confetti" and the
    // app passing it through to a renderer that has never heard of it.
    const parsed = alert.alertSpec.safeParse({
      layout: 'centered',
      elements: [{ type: 'confetti', animation: 'fade' }],
      entrance: 'fade',
      exit: 'fade',
      showLogo: true,
      volume: 0.6,
    })

    assert.equal(parsed.success, false)
  })

  test('rejects an animation that does not exist', () => {
    const parsed = alert.alertSpec.safeParse({
      layout: 'centered',
      elements: [{ type: 'username', animation: 'explode' }],
      entrance: 'fade',
      exit: 'fade',
      showLogo: true,
      volume: 0.6,
    })

    assert.equal(parsed.success, false)
  })

  test('rejects an entrance animation borrowed from the exit list', () => {
    // wipe and glitch are entrance-only. A model that treats the two lists as
    // interchangeable produces something the renderer cannot play.
    assert.equal(alert.EXIT_ANIMATIONS.includes('glitch' as never), false)

    const parsed = alert.alertSpec.safeParse({
      layout: 'centered',
      elements: [{ type: 'username', animation: 'fade' }],
      entrance: 'fade',
      exit: 'glitch',
      showLogo: true,
      volume: 0.6,
    })

    assert.equal(parsed.success, false)
  })

  test('rejects an empty element list', () => {
    const parsed = alert.alertSpec.safeParse({
      layout: 'centered',
      elements: [],
      entrance: 'fade',
      exit: 'fade',
      showLogo: true,
      volume: 0.6,
    })

    assert.equal(parsed.success, false)
  })

  test('rejects a volume outside 0 to 1', () => {
    for (const volume of [-0.5, 1.5]) {
      const parsed = alert.alertSpec.safeParse({
        layout: 'centered',
        elements: [{ type: 'username', animation: 'fade' }],
        entrance: 'fade',
        exit: 'fade',
        showLogo: true,
        volume,
      })

      assert.equal(parsed.success, false, `volume ${volume} should be rejected`)
    }
  })
})

describe('cost', () => {
  test('tokens become a small dollar figure', () => {
    // A typical design: a few hundred tokens in, under a hundred out.
    const cost = pricing.tokensToCost(600, 90)
    assert.ok(cost !== null)
    assert.ok(cost > 0, 'a real call is not free')
    assert.ok(cost < 0.01, `a single alert design should be well under a cent, got ${cost}`)
  })

  test('missing usage is null rather than zero', () => {
    // Zero would claim the call was free, which is a different statement from
    // "the provider did not tell us".
    assert.equal(pricing.tokensToCost(null, 90), null)
    assert.equal(pricing.tokensToCost(600, null), null)
  })

  test('the text model is not one of the image models', () => {
    assert.equal(pricing.findModel(pricing.TEXT_MODEL), null)
  })
})
