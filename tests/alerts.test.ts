import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, before, describe } from 'node:test'

import {
  meetsThreshold,
  renderTemplate,
  templateValuesFor,
} from '../src/lib/schemas/alert.ts'

/** Alert configuration, templates and eligibility. */

const workspace = mkdtempSync(path.join(tmpdir(), 'we-alerts-'))
process.env.WILLELEMENTS_DATA_DIR = workspace

type AlertModule = typeof import('../src/lib/services/alert-service.ts')
type AssetModule = typeof import('../src/lib/services/asset-service.ts')

let alerts: AlertModule
let assets: AssetModule
/** A real asset id — alert_configs.sound_asset_id is a foreign key. */
let soundId: string

before(async () => {
  alerts = await import('../src/lib/services/alert-service.ts')
  assets = await import('../src/lib/services/asset-service.ts')

  const wav = new Uint8Array(64)
  wav.set([0x52, 0x49, 0x46, 0x46], 0) // "RIFF"
  wav.set([0x57, 0x41, 0x56, 0x45], 8) // "WAVE"
  soundId = (await assets.saveAsset({ bytes: wav, type: 'sound' })).id
})

after(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('alert configs', () => {
  test('one is created for every event type on first read', () => {
    const configs = alerts.listAlertConfigs()

    assert.equal(configs.length, 7)
    assert.ok(configs.every((config) => config.spec.elements.length > 0))
    assert.ok(
      configs.every((config) => config.messageTemplate.trim().length > 0),
      'every alert starts with a usable message',
    )
    assert.ok(
      configs
        .filter((config) => config.eventType.startsWith('channel.'))
        .every((config) => config.messageTemplate.includes('{{username}}')),
      'channel events name the person the alert is about',
    )
  })

  test('reading twice does not create duplicates', () => {
    const first = alerts.listAlertConfigs().map((config) => config.id).sort()
    const second = alerts.listAlertConfigs().map((config) => config.id).sort()

    assert.deepEqual(first, second)
  })

  test('follow and subscribe are on by default; stream online/offline are not', () => {
    // The noisy ones stay off until asked for.
    const byType = new Map(alerts.listAlertConfigs().map((c) => [c.eventType, c]))

    assert.equal(byType.get('channel.follow')!.enabled, true)
    assert.equal(byType.get('channel.subscribe')!.enabled, true)
    assert.equal(byType.get('stream.online')!.enabled, false)
  })

  test('each type gets its own label rather than a generic one', () => {
    const follow = alerts.getAlertConfig('channel.follow')
    const raid = alerts.getAlertConfig('channel.raid')

    const labelOf = (config: typeof follow) => {
      const element = config.spec.elements.find((e) => e.type === 'label')
      return element && 'value' in element ? element.value : ''
    }

    assert.equal(labelOf(follow), 'NEW FOLLOWER')
    assert.equal(labelOf(raid), 'INCOMING RAID')
  })
})

describe('updating a config', () => {
  test('a partial update leaves the rest of the spec alone', () => {
    const before = alerts.getAlertConfig('channel.follow')

    const updated = alerts.updateAlertConfig('channel.follow', { durationMs: 8000 })

    assert.equal(updated.durationMs, 8000)
    assert.equal(updated.spec.entrance, before.spec.entrance)
    assert.equal(updated.spec.elements.length, before.spec.elements.length)
  })

  test('a spec update merges rather than replacing the whole object', () => {
    const updated = alerts.updateAlertConfig('channel.follow', {
      spec: { entrance: 'glitch' },
    })

    assert.equal(updated.spec.entrance, 'glitch')
    assert.equal(updated.spec.volume, 0.6, 'unrelated spec fields survive')
  })

  test('rejects an entrance animation that is not in the registry', () => {
    assert.throws(() =>
      alerts.updateAlertConfig('channel.follow', {
        spec: { entrance: 'explode-everything' as never },
      }),
    )

    assert.equal(
      alerts.getAlertConfig('channel.follow').spec.entrance,
      'glitch',
      'the stored value is unchanged after a rejected write',
    )
  })

  test('a sound can be cleared with null, distinct from "not provided"', () => {
    alerts.updateAlertConfig('channel.follow', { soundAssetId: soundId })
    assert.equal(alerts.getAlertConfig('channel.follow').soundAssetId, soundId)

    // An update that omits soundAssetId must not clear it...
    alerts.updateAlertConfig('channel.follow', { durationMs: 5000 })
    assert.equal(alerts.getAlertConfig('channel.follow').soundAssetId, soundId)

    // ...but an explicit null must.
    alerts.updateAlertConfig('channel.follow', { soundAssetId: null })
    assert.equal(alerts.getAlertConfig('channel.follow').soundAssetId, null)
  })
})

describe('what the overlay receives', () => {
  test('carries a resolved sound URL, not a raw asset id', () => {
    alerts.updateAlertConfig('channel.raid', { soundAssetId: soundId })

    const raid = alerts
      .getOverlayAlertConfigs()
      .find((config) => config.eventType === 'channel.raid')!

    assert.equal(raid.soundUrl, `/api/assets/${soundId}`)
  })

  test('a sound that is not a real asset is rejected by the database', () => {
    // sound_asset_id is a foreign key, so a dangling reference cannot be stored
    // and later render a broken audio element mid-stream.
    assert.throws(
      () => alerts.updateAlertConfig('channel.cheer', { soundAssetId: 'no-such-asset' }),
      /FOREIGN KEY/,
    )
  })

  test('is null when no sound is set', () => {
    const follow = alerts
      .getOverlayAlertConfigs()
      .find((config) => config.eventType === 'channel.follow')!

    assert.equal(follow.soundUrl, null)
  })
})

describe('message templates', () => {
  const raid = {
    actor: { displayName: 'PixelWraith' },
    data: { viewers: 240 },
  }

  test('fills tokens the event carries', () => {
    assert.equal(
      renderTemplate('{{username}} raided with {{viewers}}', templateValuesFor(raid)),
      'PixelWraith raided with 240',
    )
  })

  test('leaves a token the event does not carry visible rather than printing undefined', () => {
    // Seeing {{bits}} on stream is bad. Seeing "undefined" is worse, and hides
    // the fact that the template is wrong.
    assert.equal(
      renderTemplate('{{username}} cheered {{bits}}', templateValuesFor(raid)),
      'PixelWraith cheered {{bits}}',
    )
  })

  test('ignores data values that are not primitives', () => {
    const values = templateValuesFor({
      actor: { displayName: 'A' },
      data: { viewers: { nested: true } },
    })

    assert.equal(values.viewers, undefined)
  })
})

describe('minimum thresholds', () => {
  const cheer = (bits: number) => ({ type: 'channel.cheer', data: { bits } })

  test('no threshold means everything fires', () => {
    assert.equal(meetsThreshold(cheer(1), null), true)
    assert.equal(meetsThreshold(cheer(1), undefined), true)
    assert.equal(meetsThreshold(cheer(1), 0), true)
  })

  test('a cheer below the threshold stays quiet', () => {
    assert.equal(meetsThreshold(cheer(50), 100), false)
    assert.equal(meetsThreshold(cheer(100), 100), true, 'the threshold is inclusive')
    assert.equal(meetsThreshold(cheer(500), 100), true)
  })

  test('applies to raids and gift subs by their own fields', () => {
    assert.equal(meetsThreshold({ type: 'channel.raid', data: { viewers: 5 } }, 10), false)
    assert.equal(meetsThreshold({ type: 'channel.raid', data: { viewers: 50 } }, 10), true)
    assert.equal(
      meetsThreshold({ type: 'channel.subscription.gift', data: { total: 2 } }, 5),
      false,
    )
  })

  test('an event type with no measurable amount always fires', () => {
    // A follow has no quantity, so a threshold must not silently suppress it.
    assert.equal(meetsThreshold({ type: 'channel.follow', data: {} }, 100), true)
  })

  test('a missing amount fires rather than being swallowed', () => {
    assert.equal(meetsThreshold({ type: 'channel.cheer', data: {} }, 100), true)
  })
})
