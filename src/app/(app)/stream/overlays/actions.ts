'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { EVENT_TYPES } from '@/lib/schemas/event'
import { overlaySettings } from '@/lib/schemas/overlay'
import { getDefaultBrand } from '@/lib/services/brand-service'
import {
  createOverlay,
  deleteOverlay,
  renameOverlay,
  rotateOverlayToken,
} from '@/lib/services/overlay-service'
import { sendTestEvent } from '@/lib/services/test-event-service'

export type OverlayFormState = { error?: string; message?: string }

const createInput = z.object({
  name: z.string().trim().min(1, 'Give your overlay a name.').max(80),
  canvas: z.string().regex(/^\d+x\d+$/),
})

export async function createOverlayAction(
  _prev: OverlayFormState,
  formData: FormData,
): Promise<OverlayFormState> {
  const parsed = createInput.safeParse({
    name: formData.get('name'),
    canvas: formData.get('canvas'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the values and try again.' }
  }

  const [width, height] = parsed.data.canvas.split('x').map(Number)
  const brand = getDefaultBrand()

  const overlay = createOverlay(
    {
      name: parsed.data.name,
      canvasWidth: width,
      canvasHeight: height,
      settings: overlaySettings.parse({}),
    },
    brand?.id ?? null,
  )

  revalidatePath('/stream/overlays')
  redirect(`/stream/overlays/${overlay.id}`)
}

export async function rotateTokenAction(formData: FormData): Promise<void> {
  const id = formData.get('overlayId')
  if (typeof id !== 'string') return

  rotateOverlayToken(id)
  revalidatePath('/stream/overlays')
  revalidatePath(`/stream/overlays/${id}`)
}

export async function renameOverlayAction(formData: FormData): Promise<void> {
  const id = formData.get('overlayId')
  const name = formData.get('name')
  if (typeof id !== 'string' || typeof name !== 'string') return

  renameOverlay(id, name)
  revalidatePath('/stream/overlays')
  revalidatePath(`/stream/overlays/${id}`)
}

export async function deleteOverlayAction(formData: FormData): Promise<void> {
  const id = formData.get('overlayId')
  if (typeof id !== 'string') return

  deleteOverlay(id)
  revalidatePath('/stream/overlays')
  redirect('/stream/overlays')
}

/**
 * Fires a test alert at one overlay.
 *
 * Reports how many browser sources received it — pressing Test with OBS closed
 * should say so, not appear to work.
 */
export async function testAlertAction(
  _prev: OverlayFormState,
  formData: FormData,
): Promise<OverlayFormState> {
  const id = formData.get('overlayId')
  const type = formData.get('eventType')

  if (typeof id !== 'string') return { error: 'Unknown overlay.' }

  const parsedType = z.enum(EVENT_TYPES).safeParse(type)
  if (!parsedType.success) return { error: 'Unknown event type.' }

  // Delivered to every connected overlay, exactly as a real event would be —
  // which overlay shows what is each overlay's own decision.
  const delivered = sendTestEvent(parsedType.data)

  if (delivered === 0) {
    return {
      error:
        'Nothing is listening. Open this overlay in OBS (or the preview below) and try again.',
    }
  }

  return {
    message: `Sent to ${delivered} connected ${delivered === 1 ? 'source' : 'sources'}.`,
  }
}
