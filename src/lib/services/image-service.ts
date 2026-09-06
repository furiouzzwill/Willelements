import 'server-only'

import { randomUUID } from 'node:crypto'
import { desc, eq, isNotNull } from 'drizzle-orm'

import { getDb } from '@/lib/db'
import { imageGenerations, type ImageGeneration } from '@/lib/db/schema'
import {
  generateImage,
  hasApiKey,
  ImageProviderError,
} from '@/lib/providers/openai/images'
import {
  DEFAULT_MODEL,
  estimateCost,
  findModel,
  isRetired,
  type ImageModel,
  type ImageQuality,
} from '@/lib/providers/openai/pricing'
import { getDefaultBrand } from '@/lib/services/brand-service'
import { saveAsset } from '@/lib/services/asset-service'
import { buildPrompt, findSubject, PACKAGE_SUBJECT_IDS } from '@/lib/services/image-prompt'

/**
 * Generating images, and keeping an honest account of what it cost.
 *
 * The order of operations matters and is not the obvious one: the row is
 * written **after** the provider answers, not before. A row written first would
 * have to be corrected on failure, and a crash between the two would leave a
 * charge recorded that never happened. Since a failed call is not billed, the
 * safe direction is to record only what completed — and to record failures
 * separately, with a null cost, so the history still explains itself.
 */

export class ImageServiceError extends Error {}

export type GenerateRequest = {
  subjectId: string
  model?: ImageModel
  quality?: ImageQuality
  extra?: string
}

export type GenerateResult = {
  generation: ImageGeneration
  assetId: string | null
}

export async function generateForSubject(request: GenerateRequest): Promise<GenerateResult> {
  const subject = findSubject(request.subjectId)
  if (!subject) throw new ImageServiceError('Unknown subject.')

  const modelId = request.model ?? DEFAULT_MODEL
  const model = findModel(modelId)
  if (!model) throw new ImageServiceError('Unknown model.')
  if (isRetired(model)) {
    throw new ImageServiceError(`${model.label} has been retired by the provider. Pick another.`)
  }

  const brand = getDefaultBrand()
  if (!brand) throw new ImageServiceError('No brand to generate from.')

  const quality = request.quality ?? 'medium'
  const prompt = buildPrompt({
    subject,
    brandName: brand.name,
    dna: brand.dna,
    extra: request.extra,
  })

  const common = {
    brandId: brand.id,
    subject: subject.id,
    provider: 'openai',
    model: modelId,
    quality,
    size: subject.size,
    prompt,
  }

  try {
    const image = await generateImage({
      prompt,
      model: modelId,
      quality,
      size: subject.size,
      transparent: subject.transparent,
    })

    const asset = await saveAsset({
      bytes: image.bytes,
      type: subject.assetType,
      source: 'generated',
      brandId: brand.id,
      prompt,
      provider: 'openai',
      model: image.model,
    })

    const generation = getDb()
      .insert(imageGenerations)
      .values({
        id: randomUUID(),
        ...common,
        costEstimate: estimateCost(modelId, quality, subject.size),
        status: 'succeeded',
        assetId: asset.id,
      })
      .returning()
      .get()

    return { generation, assetId: asset.id }
  } catch (error) {
    const message =
      error instanceof ImageProviderError || error instanceof Error
        ? error.message
        : 'The image could not be generated.'

    // A failed call is not billed, so the cost stays null rather than zero —
    // zero would claim we know it was free, which is a different statement.
    const generation = getDb()
      .insert(imageGenerations)
      .values({
        id: randomUUID(),
        ...common,
        costEstimate: null,
        status: 'failed',
        error: message,
      })
      .returning()
      .get()

    return { generation, assetId: null }
  }
}

/**
 * Every subject, one after another.
 *
 * Sequential on purpose. Running four at once would quadruple the chance of
 * hitting a rate limit mid-package and leave you with an arbitrary subset,
 * having paid for it. One at a time means a failure stops at a known point.
 */
export async function generatePackage(options: {
  model?: ImageModel
  quality?: ImageQuality
  extra?: string
}): Promise<GenerateResult[]> {
  const results: GenerateResult[] = []

  for (const subjectId of PACKAGE_SUBJECT_IDS) {
    const result = await generateForSubject({ ...options, subjectId })
    results.push(result)

    // Stop on the first failure rather than spending three more times against
    // whatever is already going wrong.
    if (result.generation.status === 'failed') break
  }

  return results
}

export type SpendSummary = {
  /** Estimated dollars across every succeeded generation with a known price. */
  total: number
  /** Succeeded generations whose model publishes no price we could verify. */
  unpricedCount: number
  succeededCount: number
  failedCount: number
}

/**
 * What this has cost, as far as the app can tell.
 *
 * `unpricedCount` is reported beside the total rather than folded into it. A
 * total that silently omits some generations reads as complete when it is not,
 * and the fix is to say how many are missing rather than to invent prices for
 * them.
 */
export function spendSummary(): SpendSummary {
  const rows = getDb().select().from(imageGenerations).all()
  const succeeded = rows.filter((row) => row.status === 'succeeded')

  return {
    total:
      Math.round(
        succeeded.reduce((sum, row) => sum + (row.costEstimate ?? 0), 0) * 10_000,
      ) / 10_000,
    unpricedCount: succeeded.filter((row) => row.costEstimate === null).length,
    succeededCount: succeeded.length,
    failedCount: rows.filter((row) => row.status === 'failed').length,
  }
}

export function listGenerations(limit = 40): ImageGeneration[] {
  return getDb()
    .select()
    .from(imageGenerations)
    .orderBy(desc(imageGenerations.createdAt))
    .limit(limit)
    .all()
}

/** Succeeded generations that still have their asset, for a gallery. */
export function listGeneratedImages(limit = 60): ImageGeneration[] {
  return getDb()
    .select()
    .from(imageGenerations)
    .where(isNotNull(imageGenerations.assetId))
    .orderBy(desc(imageGenerations.createdAt))
    .limit(limit)
    .all()
}

export function getGeneration(id: string): ImageGeneration | null {
  return (
    getDb().select().from(imageGenerations).where(eq(imageGenerations.id, id)).get() ?? null
  )
}

export { hasApiKey }
