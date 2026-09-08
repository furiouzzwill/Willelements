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

export type DesignFormState = {
  error?: string
  message?: string
  /** The generated spec, for the editor to apply without a round trip. */
  spec?: unknown
}

/**
 * "Make it look like…" — a description becomes an alert specification.
 *
 * Nothing is saved. The generated spec is handed back for the editor to load
 * into its own controls so it can be previewed and adjusted, and it only
 * reaches the database if the person then presses Save. Designing costs a
 * fraction of a cent; overwriting a working alert without being asked would
 * cost more than that to undo.
 */
export async function designAlertAction(
  _prev: DesignFormState,
  formData: FormData,
): Promise<DesignFormState> {
  const type = eventTypeSchema.safeParse(formData.get('eventType'))
  if (!type.success) return { error: 'Unknown alert type.' }

  const description = String(formData.get('description') ?? '').trim()
  if (!description) return { error: 'Describe the alert you want.' }
  if (description.length > 600) return { error: 'Keep the description under 600 characters.' }

  try {
    const { designAlert } = await import('@/lib/services/alert-design-service')
    const result = await designAlert({ eventType: type.data, description })

    return {
      message: 'Designed. Look it over, then Save to keep it.',
      spec: result.spec,
    }
  } catch (error) {
    console.error('[alerts] design failed', error)
    return {
      error: error instanceof Error ? error.message : 'That design could not be generated.',
    }
  }
}

/**
 * Saves a designed spec straight onto an alert.
 *
 * The in-editor panel hands its result to the surrounding form and saves
 * nothing, because that form is right there to adjust first. The AI Create
 * studio has no such form, so it needs a way to commit a design directly —
 * still only when asked, never as a side effect of generating one.
 */
export async function applyDesignedSpec(
  _prev: AlertFormState,
  formData: FormData,
): Promise<AlertFormState> {
  const type = eventTypeSchema.safeParse(formData.get('eventType'))
  if (!type.success) return { error: 'Unknown alert type.' }

  let raw: unknown
  try {
    raw = JSON.parse(String(formData.get('spec') ?? ''))
  } catch {
    return { error: 'That design could not be read.' }
  }

  // Parsed again here rather than trusted from the client. It was validated
  // when generated, but it has been through the browser since.
  const parsed = alertSpec.safeParse(raw)
  if (!parsed.success) return { error: 'That design is not in a shape this app can render.' }

  updateAlertConfig(type.data, { spec: parsed.data })
  revalidate(type.data)

  return { message: 'Saved. It will play the next time that event fires.' }
}

/**
 * Generates a full composition — real markup, styles and script.
 *
 * Deliberately separate from `designAlertAction`, which stays inside the
 * closed vocabulary. This is the mode that writes code, and keeping the two
 * apart means the safer one is never reached by accident.
 */
export async function composeAlertAction(
  _prev: DesignFormState,
  formData: FormData,
): Promise<DesignFormState> {
  const type = eventTypeSchema.safeParse(formData.get('eventType'))
  if (!type.success) return { error: 'Unknown alert type.' }

  const description = String(formData.get('description') ?? '').trim()
  if (!description) return { error: 'Describe the alert you want.' }
  if (description.length > 600) return { error: 'Keep the description under 600 characters.' }

  // A revision carries the composition being changed, so "make it bigger" is a
  // change to that one rather than a fresh attempt at the same words.
  let previous: { html: string; summary: string } | undefined
  const previousRaw = formData.get('previous')
  if (typeof previousRaw === 'string' && previousRaw.length > 0) {
    try {
      const parsed = JSON.parse(previousRaw) as { html?: unknown; summary?: unknown }
      if (typeof parsed.html === 'string') {
        previous = {
          html: parsed.html,
          summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        }
      }
    } catch {
      // A previous that cannot be read is treated as absent: the worst case is
      // a fresh generation, which is better than refusing to do anything.
    }
  }

  try {
    const { generateComposition } = await import('@/lib/services/composition-service')
    const result = await generateComposition({ eventType: type.data, description, previous })

    return {
      message: result.composition.summary || 'Built. Look it over, then Save to keep it.',
      spec: result.composition,
    }
  } catch (error) {
    console.error('[alerts] composition failed', error)
    return {
      error: error instanceof Error ? error.message : 'That composition could not be built.',
    }
  }
}

/** Saves a generated composition onto an alert, or clears one. */
export async function applyComposition(
  _prev: AlertFormState,
  formData: FormData,
): Promise<AlertFormState> {
  const type = eventTypeSchema.safeParse(formData.get('eventType'))
  if (!type.success) return { error: 'Unknown alert type.' }

  const existing = getAlertConfig(type.data)

  if (formData.get('clear') === '1') {
    // The rest of the spec was kept while a composition was in use, so
    // removing it returns the alert to exactly what it was before.
    const rest = { ...existing.spec }
    delete rest.composition
    updateAlertConfig(type.data, { spec: alertSpec.parse(rest) })
    revalidate(type.data)
    return { message: 'Composition removed. The alert is back to its previous design.' }
  }

  let raw: unknown
  try {
    raw = JSON.parse(String(formData.get('composition') ?? ''))
  } catch {
    return { error: 'That composition could not be read.' }
  }

  // Re-validated and re-screened server-side. It was checked when generated,
  // but it has been through the browser since.
  const { composition, screenComposition } = await import('@/lib/schemas/composition')
  const parsed = composition.safeParse(raw)
  if (!parsed.success) return { error: 'That composition is not in a usable shape.' }

  const issues = screenComposition(parsed.data.html)
  if (issues.length > 0) {
    return {
      error: `Rejected: it contained ${[...new Set(issues.map((i) => i.reason))].join(', ')}.`,
    }
  }

  updateAlertConfig(type.data, {
    spec: alertSpec.parse({ ...existing.spec, composition: parsed.data }),
  })
  revalidate(type.data)

  return { message: 'Saved. It will play the next time that event fires.' }
}
