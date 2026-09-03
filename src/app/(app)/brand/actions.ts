'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { brandDna, brandInput } from '@/lib/schemas/brand'
import { getDefaultBrand, updateBrand } from '@/lib/services/brand-service'
import {
  AssetValidationError,
  MAX_UPLOAD_BYTES,
  deleteAsset,
  saveAsset,
} from '@/lib/services/asset-service'
import { setBrandLogo } from '@/lib/services/brand-service'

export type FormState = { error?: string; message?: string; fieldErrors?: Record<string, string> }

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (key && !result[key]) result[key] = issue.message
  }
  return result
}

/** Trims to null so an emptied field clears rather than storing "". */
function text(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function list(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
}

export async function saveIdentity(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const brand = getDefaultBrand()
  if (!brand) return { error: 'No brand to edit.' }

  const parsed = brandInput
    .pick({ name: true, description: true, audience: true, creatorType: true })
    .safeParse({
      name: formData.get('name'),
      description: text(formData, 'description'),
      audience: text(formData, 'audience'),
      creatorType: formData.get('creatorType') ?? 'streamer',
    })

  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) }

  updateBrand(brand.id, parsed.data)
  revalidatePath('/', 'layout')
  return { message: 'Identity saved.' }
}

export async function saveDna(_prev: FormState, formData: FormData): Promise<FormState> {
  const brand = getDefaultBrand()
  if (!brand) return { error: 'No brand to edit.' }

  const parsed = brandDna.safeParse({
    personality: list(formData, 'personality'),
    colors: {
      primary: formData.get('primary'),
      secondary: formData.get('secondary'),
      accent: formData.get('accent'),
      background: formData.get('background'),
      text: formData.get('text'),
    },
    typography: {
      heading: formData.get('heading'),
      body: formData.get('body'),
    },
    visualStyle: {
      canvas: formData.get('canvas'),
      style: formData.get('style'),
      detail: formData.get('detail'),
    },
    motionStyle: {
      energy: formData.get('energy'),
      speed: formData.get('speed'),
      style: list(formData, 'motionStyle'),
    },
    rules: {
      prefer: list(formData, 'prefer'),
      avoid: list(formData, 'avoid'),
    },
  })

  if (!parsed.success) {
    return {
      error: 'Some values could not be saved.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  updateBrand(brand.id, { dna: parsed.data })
  revalidatePath('/', 'layout')
  return { message: 'Brand DNA saved.' }
}

export async function uploadLogo(_prev: FormState, formData: FormData): Promise<FormState> {
  const brand = getDefaultBrand()
  if (!brand) return { error: 'Create a brand first.' }

  const file = formData.get('logo')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose an image first.' }
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `Images must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` }
  }

  try {
    const asset = await saveAsset({
      bytes: new Uint8Array(await file.arrayBuffer()),
      type: 'logo',
      brandId: brand.id,
    })

    // The first logo uploaded becomes the brand's logo automatically.
    if (!brand.logoAssetId) setBrandLogo(brand.id, asset.id)

    revalidatePath('/', 'layout')
    return { message: 'Logo uploaded.' }
  } catch (error) {
    if (error instanceof AssetValidationError) return { error: error.message }
    console.error('[brand] logo upload failed', error)
    return { error: 'That file could not be saved.' }
  }
}

export async function choosePrimaryLogo(formData: FormData): Promise<void> {
  const brand = getDefaultBrand()
  const assetId = formData.get('assetId')
  if (!brand || typeof assetId !== 'string') return

  setBrandLogo(brand.id, assetId)
  revalidatePath('/', 'layout')
}

export async function removeAsset(formData: FormData): Promise<void> {
  const assetId = formData.get('assetId')
  if (typeof assetId !== 'string') return

  await deleteAsset(assetId)
  revalidatePath('/', 'layout')
}
