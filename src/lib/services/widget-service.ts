import 'server-only'

import { asc, eq, sql } from 'drizzle-orm'

import { getDb } from '@/lib/db'
import { readJson, writeJson } from '@/lib/db/json'
import { overlayWidgets, type OverlayWidget } from '@/lib/db/schema'
import {
  IMPLEMENTED_WIDGET_TYPES,
  WIDGET_DEFAULT_SIZE,
  defaultConfigFor,
  widgetConfig,
  type OverlayWidgetModel,
  type WidgetConfig,
  type WidgetType,
} from '@/lib/schemas/overlay'

/**
 * Widgets placed on an overlay.
 *
 * Positions are stored in **canvas pixels**, not percentages, so an overlay
 * built for 1920×1080 lands identically in OBS regardless of what size the
 * editor happened to be displayed at.
 */

function hydrate(row: OverlayWidget): OverlayWidgetModel {
  return {
    id: row.id,
    type: row.type as WidgetType,
    config: readJson(widgetConfig, row.config, `overlay_widgets.config (${row.id})`),
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    zIndex: row.zIndex,
    locked: row.locked,
  }
}

/** Widgets for one overlay, back to front. */
export function listWidgets(overlayId: string): OverlayWidgetModel[] {
  return getDb()
    .select()
    .from(overlayWidgets)
    .where(eq(overlayWidgets.overlayId, overlayId))
    .orderBy(asc(overlayWidgets.zIndex))
    .all()
    .map(hydrate)
}

export function getWidget(id: string): OverlayWidgetModel | null {
  const row = getDb().select().from(overlayWidgets).where(eq(overlayWidgets.id, id)).get()
  return row ? hydrate(row) : null
}

/** Adds a widget, placed near the top-left and stacked above everything else. */
export function addWidget(
  overlayId: string,
  type: WidgetType,
  position?: { x: number; y: number },
): OverlayWidgetModel {
  if (!IMPLEMENTED_WIDGET_TYPES.includes(type)) {
    throw new Error(`${type} is not a widget the runtime can render yet.`)
  }

  const size = WIDGET_DEFAULT_SIZE[type]
  const existing = listWidgets(overlayId)
  const topZ = existing.reduce((highest, widget) => Math.max(highest, widget.zIndex), -1)

  // Stagger each new widget rather than dropping them all in the same corner —
  // three widgets in a pile looks broken and has to be untangled by dragging
  // blind. Wraps after a few so they stay on canvas.
  const offset = (existing.length % 6) * 40

  const row = getDb()
    .insert(overlayWidgets)
    .values({
      overlayId,
      type,
      config: writeJson(widgetConfig, defaultConfigFor(type)),
      x: position?.x ?? 80 + offset,
      y: position?.y ?? 80 + offset,
      width: size.width,
      height: size.height,
      zIndex: topZ + 1,
    })
    .returning()
    .get()

  return hydrate(row)
}

export type WidgetUpdate = {
  x?: number
  y?: number
  width?: number
  height?: number
  zIndex?: number
  locked?: boolean
  config?: Partial<WidgetConfig>
}

export function updateWidget(id: string, update: WidgetUpdate): OverlayWidgetModel {
  const existing = getWidget(id)
  if (!existing) throw new Error(`No widget with id ${id}`)

  // Validate the merged config rather than the patch, so a partial update
  // cannot leave a shape the schema would reject on read.
  const config = update.config
    ? widgetConfig.parse({ ...existing.config, ...update.config })
    : existing.config

  const row = getDb()
    .update(overlayWidgets)
    .set({
      // Widgets are allowed to sit partly off-canvas — a lower third often
      // does — but a negative size would be unrenderable.
      x: Math.round(update.x ?? existing.x),
      y: Math.round(update.y ?? existing.y),
      width: Math.max(20, Math.round(update.width ?? existing.width)),
      height: Math.max(20, Math.round(update.height ?? existing.height)),
      zIndex: update.zIndex ?? existing.zIndex,
      locked: update.locked ?? existing.locked,
      config: writeJson(widgetConfig, config),
    })
    .where(eq(overlayWidgets.id, id))
    .returning()
    .get()

  return hydrate(row)
}

export function deleteWidget(id: string): void {
  getDb().delete(overlayWidgets).where(eq(overlayWidgets.id, id)).run()
}

/** Moves a widget one step forward or back in the stacking order. */
export function reorderWidget(id: string, direction: 'forward' | 'backward'): void {
  const widget = getWidget(id)
  if (!widget) return

  const siblings = listWidgets(
    getDb()
      .select({ overlayId: overlayWidgets.overlayId })
      .from(overlayWidgets)
      .where(eq(overlayWidgets.id, id))
      .get()!.overlayId,
  )

  const index = siblings.findIndex((candidate) => candidate.id === id)
  const swapWith = direction === 'forward' ? siblings[index + 1] : siblings[index - 1]
  if (!swapWith) return

  // Swap the two z-indexes rather than renumbering everything.
  const db = getDb()
  db.transaction((tx) => {
    tx.update(overlayWidgets)
      .set({ zIndex: swapWith.zIndex })
      .where(eq(overlayWidgets.id, widget.id))
      .run()
    tx.update(overlayWidgets)
      .set({ zIndex: widget.zIndex })
      .where(eq(overlayWidgets.id, swapWith.id))
      .run()
  })
}

export function duplicateWidget(id: string): OverlayWidgetModel | null {
  const source = getDb().select().from(overlayWidgets).where(eq(overlayWidgets.id, id)).get()
  if (!source) return null

  const topZ =
    getDb()
      .select({ max: sql<number>`max(${overlayWidgets.zIndex})` })
      .from(overlayWidgets)
      .where(eq(overlayWidgets.overlayId, source.overlayId))
      .get()?.max ?? 0

  const row = getDb()
    .insert(overlayWidgets)
    .values({
      overlayId: source.overlayId,
      type: source.type,
      config: source.config,
      // Offset slightly so the copy is visibly distinct from the original.
      x: source.x + 24,
      y: source.y + 24,
      width: source.width,
      height: source.height,
      zIndex: topZ + 1,
      locked: false,
    })
    .returning()
    .get()

  return hydrate(row)
}
