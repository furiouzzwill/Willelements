import 'server-only'

import { asc, eq } from 'drizzle-orm'

import { getDb } from '@/lib/db'
import { generateOverlayToken } from '@/lib/db/tokens'
import { readJson, writeJson } from '@/lib/db/json'
import { overlayWidgets, overlays, type Overlay } from '@/lib/db/schema'
import {
  overlayInput,
  overlaySettings,
  type OverlayInput,
  type OverlaySettings,
} from '@/lib/schemas/overlay'
import { siteUrl } from '@/lib/env'

/**
 * Overlays — the saved canvases OBS points at.
 *
 * The `publicToken` is what appears in the browser-source URL. It is separate
 * from the row's id so it can be rotated: a URL shown on stream by accident is
 * revoked by generating a new token, without disturbing the overlay's widgets,
 * name or anything referencing it.
 */

export type OverlayWithSettings = Omit<Overlay, 'settings'> & {
  settings: OverlaySettings
}

function hydrate(row: Overlay): OverlayWithSettings {
  return {
    ...row,
    settings: readJson(overlaySettings, row.settings, `overlays.settings (${row.id})`),
  }
}

function now(): string {
  return new Date().toISOString()
}

export function listOverlays(): OverlayWithSettings[] {
  return getDb().select().from(overlays).orderBy(asc(overlays.createdAt)).all().map(hydrate)
}

export function getOverlay(id: string): OverlayWithSettings | null {
  const row = getDb().select().from(overlays).where(eq(overlays.id, id)).get()
  return row ? hydrate(row) : null
}

/** Looks an overlay up by its browser-source token. Used only by the OBS route. */
export function getOverlayByToken(token: string): OverlayWithSettings | null {
  // Guard against a malformed path segment reaching the query at all.
  if (!/^[0-9a-f]{32}$/.test(token)) return null

  const row = getDb().select().from(overlays).where(eq(overlays.publicToken, token)).get()
  return row ? hydrate(row) : null
}

export function createOverlay(input: OverlayInput, brandId?: string | null): OverlayWithSettings {
  const parsed = overlayInput.parse(input)

  const row = getDb()
    .insert(overlays)
    .values({
      brandId: brandId ?? null,
      name: parsed.name,
      canvasWidth: parsed.canvasWidth,
      canvasHeight: parsed.canvasHeight,
      settings: writeJson(overlaySettings, parsed.settings),
      publicToken: generateOverlayToken(),
    })
    .returning()
    .get()

  return hydrate(row)
}

export function renameOverlay(id: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('An overlay needs a name.')

  getDb()
    .update(overlays)
    .set({ name: trimmed.slice(0, 80), updatedAt: now() })
    .where(eq(overlays.id, id))
    .run()
}

/**
 * Issues a new browser-source token, invalidating the old URL immediately.
 *
 * The old URL stops working the moment this returns, so the UI warns that OBS
 * needs the new one pasted in.
 */
export function rotateOverlayToken(id: string): string {
  const token = generateOverlayToken()

  getDb()
    .update(overlays)
    .set({ publicToken: token, tokenRotatedAt: now(), updatedAt: now() })
    .where(eq(overlays.id, id))
    .run()

  return token
}

export function deleteOverlay(id: string): void {
  // overlay_widgets cascades in the schema; this is just the parent row.
  getDb().delete(overlays).where(eq(overlays.id, id)).run()
}

export function countWidgets(overlayId: string): number {
  return getDb()
    .select({ id: overlayWidgets.id })
    .from(overlayWidgets)
    .where(eq(overlayWidgets.overlayId, overlayId))
    .all().length
}

/** The URL to paste into an OBS browser source. */
export function browserSourceUrl(overlay: { publicToken: string }): string {
  return `${siteUrl()}/overlay/${overlay.publicToken}`
}
