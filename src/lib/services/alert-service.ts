import 'server-only'

import { eq } from 'drizzle-orm'

import { getDb } from '@/lib/db'
import { readJson, writeJson } from '@/lib/db/json'
import { alertConfigs, type AlertConfig } from '@/lib/db/schema'
import {
  DEFAULT_TEMPLATES,
  alertSpec,
  defaultSpecFor,
  type AlertSpec,
} from '@/lib/schemas/alert'
import { EVENT_TYPES, type EventType } from '@/lib/schemas/event'
import { getDefaultBrand } from '@/lib/services/brand-service'

/**
 * Alert configuration — how each event type looks and sounds.
 *
 * A config is created for every event type on first read rather than seeded at
 * install time. That covers a fresh database and an existing one equally, and
 * it means adding a new event type in a later phase needs no migration: the
 * first page load creates its config.
 */

export type AlertConfigWithSpec = Omit<AlertConfig, 'spec'> & { spec: AlertSpec }

function hydrate(row: AlertConfig): AlertConfigWithSpec {
  return {
    ...row,
    spec: readJson(alertSpec, row.spec, `alert_configs.spec (${row.eventType})`),
  }
}

function now(): string {
  return new Date().toISOString()
}

/**
 * Creates any missing configs, then returns them all in a stable order.
 *
 * Idempotent — the insert is skipped for event types that already have one.
 */
export function listAlertConfigs(): AlertConfigWithSpec[] {
  const db = getDb()
  const existing = db.select().from(alertConfigs).all()
  const byType = new Map(existing.map((row) => [row.eventType, row]))

  const missing = EVENT_TYPES.filter((type) => !byType.has(type))

  if (missing.length > 0) {
    const brand = getDefaultBrand()

    for (const eventType of missing) {
      const row = db
        .insert(alertConfigs)
        .values({
          brandId: brand?.id ?? null,
          eventType,
          spec: writeJson(alertSpec, defaultSpecFor(eventType)),
          messageTemplate: DEFAULT_TEMPLATES[eventType] ?? '{{username}}',
          durationMs: 5000,
          // Stream online/offline are noisy by default; the rest are useful.
          enabled: eventType !== 'stream.online' && eventType !== 'stream.offline',
        })
        .returning()
        .get()

      byType.set(eventType, row)
    }
  }

  return EVENT_TYPES.map((type) => hydrate(byType.get(type)!))
}

export function getAlertConfig(eventType: EventType): AlertConfigWithSpec {
  const found = listAlertConfigs().find((config) => config.eventType === eventType)
  if (!found) throw new Error(`No alert config for ${eventType}`)
  return found
}

export type AlertConfigUpdate = {
  spec?: Partial<AlertSpec>
  messageTemplate?: string
  durationMs?: number
  soundAssetId?: string | null
  minThreshold?: number | null
  enabled?: boolean
}

export function updateAlertConfig(
  eventType: EventType,
  update: AlertConfigUpdate,
): AlertConfigWithSpec {
  const existing = getAlertConfig(eventType)

  // Validate the merged result rather than the patch, so a partial update can
  // never leave a stored spec in a shape the schema would reject on read.
  const spec = update.spec
    ? alertSpec.parse({ ...existing.spec, ...update.spec })
    : existing.spec

  const row = getDb()
    .update(alertConfigs)
    .set({
      spec: writeJson(alertSpec, spec),
      messageTemplate: update.messageTemplate ?? existing.messageTemplate,
      durationMs: update.durationMs ?? existing.durationMs,
      soundAssetId:
        update.soundAssetId !== undefined ? update.soundAssetId : existing.soundAssetId,
      minThreshold:
        update.minThreshold !== undefined ? update.minThreshold : existing.minThreshold,
      enabled: update.enabled ?? existing.enabled,
      updatedAt: now(),
    })
    .where(eq(alertConfigs.id, existing.id))
    .returning()
    .get()

  return hydrate(row)
}

/**
 * Everything the overlay needs to render alerts, resolved once at page load.
 *
 * Passing this down means an alert costs one render and no network request —
 * which is the difference between an alert that lands on time and one that
 * arrives after the moment has passed.
 */
export type OverlayAlertConfig = {
  eventType: string
  enabled: boolean
  messageTemplate: string
  durationMs: number
  minThreshold: number | null
  soundUrl: string | null
  spec: AlertSpec
}

export function getOverlayAlertConfigs(): OverlayAlertConfig[] {
  return listAlertConfigs().map((config) => ({
    eventType: config.eventType,
    enabled: config.enabled,
    messageTemplate: config.messageTemplate,
    durationMs: config.durationMs,
    minThreshold: config.minThreshold,
    soundUrl: config.soundAssetId ? `/api/assets/${config.soundAssetId}` : null,
    spec: config.spec,
  }))
}
