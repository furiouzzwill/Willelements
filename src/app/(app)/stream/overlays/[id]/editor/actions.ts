'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { IMPLEMENTED_WIDGET_TYPES, widgetConfig } from '@/lib/schemas/overlay'
import {
  addWidget,
  deleteWidget,
  duplicateWidget,
  reorderWidget,
  updateWidget,
} from '@/lib/services/widget-service'

/**
 * Editor mutations.
 *
 * Positions arrive from the browser, so every one is validated: a widget the
 * user cannot see or reach would be a maddening bug to diagnose from the
 * overlay side.
 */

const widgetType = z.enum(IMPLEMENTED_WIDGET_TYPES as unknown as [string, ...string[]])

function revalidateEditor(overlayId: string) {
  revalidatePath(`/stream/overlays/${overlayId}/editor`)
  revalidatePath(`/stream/overlays/${overlayId}`)
  // The OBS page resolves its widgets at load, so it needs the new version too.
  revalidatePath('/overlay/[token]', 'page')
}

export async function addWidgetAction(formData: FormData): Promise<void> {
  const overlayId = String(formData.get('overlayId') ?? '')
  const parsed = widgetType.safeParse(formData.get('type'))
  if (!overlayId || !parsed.success) return

  addWidget(overlayId, parsed.data as never)
  revalidateEditor(overlayId)
}

const geometry = z.object({
  x: z.coerce.number().int().min(-10_000).max(10_000),
  y: z.coerce.number().int().min(-10_000).max(10_000),
  width: z.coerce.number().int().min(20).max(10_000),
  height: z.coerce.number().int().min(20).max(10_000),
})

/** Saves a drag or resize. Called as the pointer is released, not during. */
export async function moveWidgetAction(input: {
  overlayId: string
  widgetId: string
  x: number
  y: number
  width: number
  height: number
}): Promise<void> {
  const parsed = geometry.safeParse(input)
  if (!parsed.success) return

  updateWidget(input.widgetId, parsed.data)
  revalidateEditor(input.overlayId)
}

export async function updateWidgetConfigAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const overlayId = String(formData.get('overlayId') ?? '')
  const widgetId = String(formData.get('widgetId') ?? '')
  const raw = formData.get('config')

  if (!overlayId || !widgetId || typeof raw !== 'string') {
    return { error: 'Could not save that change.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'Could not save that change.' }
  }

  const config = widgetConfig.safeParse(parsed)
  if (!config.success) {
    return { error: config.error.issues[0]?.message ?? 'Those settings are not valid.' }
  }

  updateWidget(widgetId, { config: config.data })
  revalidateEditor(overlayId)
  return {}
}

export async function deleteWidgetAction(formData: FormData): Promise<void> {
  const overlayId = String(formData.get('overlayId') ?? '')
  const widgetId = String(formData.get('widgetId') ?? '')
  if (!overlayId || !widgetId) return

  deleteWidget(widgetId)
  revalidateEditor(overlayId)
}

export async function duplicateWidgetAction(formData: FormData): Promise<void> {
  const overlayId = String(formData.get('overlayId') ?? '')
  const widgetId = String(formData.get('widgetId') ?? '')
  if (!overlayId || !widgetId) return

  duplicateWidget(widgetId)
  revalidateEditor(overlayId)
}

export async function reorderWidgetAction(formData: FormData): Promise<void> {
  const overlayId = String(formData.get('overlayId') ?? '')
  const widgetId = String(formData.get('widgetId') ?? '')
  const direction = formData.get('direction')
  if (!overlayId || !widgetId) return
  if (direction !== 'forward' && direction !== 'backward') return

  reorderWidget(widgetId, direction)
  revalidateEditor(overlayId)
}

export async function toggleLockAction(formData: FormData): Promise<void> {
  const overlayId = String(formData.get('overlayId') ?? '')
  const widgetId = String(formData.get('widgetId') ?? '')
  const locked = formData.get('locked') === 'true'
  if (!overlayId || !widgetId) return

  updateWidget(widgetId, { locked: !locked })
  revalidateEditor(overlayId)
}
