'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  ENTRANCE_ANIMATIONS,
  EXIT_ANIMATIONS,
  alertSpec,
} from '@/lib/schemas/alert'
import { EVENT_TYPES, type EventType } from '@/lib/schemas/event'
import {
  AssetValidationError,
  MAX_UPLOAD_BYTES,
  saveAsset,
} from '@/lib/services/asset-service'
import { getAlertConfig, updateAlertConfig } from '@/lib/services/alert-service'
import { getDefaultBrand } from '@/lib/services/brand-service'

export type AlertFormState = { error?: string; message?: string }

const eventTypeSchema = z.enum(EVENT_TYPES)

const settingsSchema = z.object({
  messageTemplate: z.string().trim().min(1, 'The message cannot be empty.').max(200),
  durationMs: z.coerce.number().int().min(1000).max(30_000),
  layout: alertSpec.shape.layout,
  entrance: z.enum(ENTRANCE_ANIMATIONS),
  exit: z.enum(EXIT_ANIMATIONS),
  labelText: z.string().trim().max(60),
  labelAnimation: z.enum(['none', 'fade', 'scale', 'word-reveal']),
  usernameAnimation: z.enum(['none', 'fade', 'scale']),
  showLogo: z.boolean(),
  volume: z.coerce.number().min(0).max(1),
  minThreshold: z.union([z.coerce.number().int().positive(), z.literal('')]).nullish(),
  enabled: z.boolean(),
})

function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === 'on'
}

function revalidate(eventType: string) {
  revalidatePath('/stream/alerts')
  revalidatePath(`/stream/alerts/${encodeURIComponent(eventType)}`)
  // The overlay resolves its configs at page load, so it must re-render too.
  revalidatePath('/overlay/[token]', 'page')
}

export async function saveAlertSettings(
  _prev: AlertFormState,
  formData: FormData,
): Promise<AlertFormState> {
  const type = eventTypeSchema.safeParse(formData.get('eventType'))
  if (!type.success) return { error: 'Unknown alert type.' }

  const parsed = settingsSchema.safeParse({
    messageTemplate: formData.get('messageTemplate'),
    durationMs: formData.get('durationMs'),
    layout: formData.get('layout'),
    entrance: formData.get('entrance'),
    exit: formData.get('exit'),
    labelText: formData.get('labelText'),
    labelAnimation: formData.get('labelAnimation'),
    usernameAnimation: formData.get('usernameAnimation'),
    showLogo: checkbox(formData, 'showLogo'),
    volume: formData.get('volume'),
    minThreshold: formData.get('minThreshold'),
    enabled: checkbox(formData, 'enabled'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the values and try again.' }
  }

  const input = parsed.data
  const existing = getAlertConfig(type.data as EventType)

  updateAlertConfig(type.data as EventType, {
    messageTemplate: input.messageTemplate,
    durationMs: input.durationMs,
    enabled: input.enabled,
    minThreshold:
      input.minThreshold === '' || input.minThreshold == null ? null : input.minThreshold,
    spec: {
      ...existing.spec,
      layout: input.layout,
      entrance: input.entrance,
      exit: input.exit,
      showLogo: input.showLogo,
      volume: input.volume,
      elements: [
        { type: 'label', value: input.labelText || 'ALERT', animation: input.labelAnimation },
        { type: 'username', animation: input.usernameAnimation },
      ],
    },
  })

  revalidate(type.data)
  return { message: 'Alert saved.' }
}

export async function uploadAlertSound(
  _prev: AlertFormState,
  formData: FormData,
): Promise<AlertFormState> {
  const type = eventTypeSchema.safeParse(formData.get('eventType'))
  if (!type.success) return { error: 'Unknown alert type.' }

  const file = formData.get('sound')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a sound file.' }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `Sounds must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` }
  }

  try {
    const asset = await saveAsset({
      bytes: new Uint8Array(await file.arrayBuffer()),
      type: 'sound',
      brandId: getDefaultBrand()?.id ?? null,
    })

    if (!asset.mimeType.startsWith('audio/')) {
      return { error: 'That file is not audio. Use MP3 or WAV.' }
    }

    updateAlertConfig(type.data as EventType, { soundAssetId: asset.id })
    revalidate(type.data)
    return { message: 'Sound added.' }
  } catch (error) {
    if (error instanceof AssetValidationError) return { error: error.message }
    console.error('[alerts] sound upload failed', error)
    return { error: 'That file could not be saved.' }
  }
}

export async function removeAlertSound(formData: FormData): Promise<void> {
  const type = eventTypeSchema.safeParse(formData.get('eventType'))
  if (!type.success) return

  // The asset stays in the library; only the alert stops referencing it.
  updateAlertConfig(type.data as EventType, { soundAssetId: null })
  revalidate(type.data)
}

export async function toggleAlert(formData: FormData): Promise<void> {
  const type = eventTypeSchema.safeParse(formData.get('eventType'))
  if (!type.success) return

  const config = getAlertConfig(type.data as EventType)
  updateAlertConfig(type.data as EventType, { enabled: !config.enabled })
  revalidate(type.data)
}
