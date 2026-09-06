/**
 * What an image costs, as far as we can know it.
 *
 * This is the only part of the project that spends money, so the number has to
 * be in front of you before you press the button and again after. But the
 * figures below are a **published price list read on a date**, not something
 * OpenAI told us about your account — no discount, credit, tax or tier is
 * visible from here.
 *
 * So the app calls it an estimate everywhere, and the authority on what you
 * actually paid is OpenAI's own usage dashboard. Presenting a computed number
 * as a billed one would be exactly the sort of invented figure this project
 * treats as a bug.
 *
 * A model whose price is not published in a form we could verify gets `null`
 * rather than a guess. The UI then says the cost is unknown, which is true and
 * useful, where a plausible wrong number is neither.
 */

/** When the prices below were last read from OpenAI's documentation. */
export const PRICES_CHECKED_AT = '2026-09-06'

export const IMAGE_MODELS = [
  'gpt-image-1.5',
  'gpt-image-1-mini',
  'gpt-image-2',
  'gpt-image-1',
] as const

export type ImageModel = (typeof IMAGE_MODELS)[number]

export type ImageQuality = 'low' | 'medium' | 'high'

/** The three sizes the gpt-image family accepts. */
export const IMAGE_SIZES = ['1024x1024', '1536x1024', '1024x1536'] as const

export type ImageSize = (typeof IMAGE_SIZES)[number]

export type ModelInfo = {
  id: ImageModel
  label: string
  description: string
  /** Dollars per image, or null where no verifiable price is published. */
  price: Record<ImageQuality, { square: number; rectangle: number }> | null
  /** ISO date after which this model stops working, if one is announced. */
  retiresOn?: string
}

export const MODELS: ModelInfo[] = [
  {
    id: 'gpt-image-1.5',
    label: 'GPT Image 1.5',
    description: 'Documented per-image pricing, no announced retirement. The default.',
    price: {
      low: { square: 0.009, rectangle: 0.013 },
      medium: { square: 0.034, rectangle: 0.05 },
      high: { square: 0.133, rectangle: 0.2 },
    },
  },
  {
    id: 'gpt-image-1-mini',
    label: 'GPT Image 1 mini',
    description: 'Cheapest by a wide margin. Good for trying a direction before committing.',
    price: {
      low: { square: 0.005, rectangle: 0.007 },
      medium: { square: 0.011, rectangle: 0.016 },
      high: { square: 0.036, rectangle: 0.054 },
    },
  },
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    description:
      'The newest model. Its per-image price is not published in a form this app could verify, so spend for it is recorded as unknown rather than guessed.',
    price: null,
  },
  {
    id: 'gpt-image-1',
    label: 'GPT Image 1',
    description: 'The original. Retiring — prefer 1.5 unless you have a reason.',
    price: {
      low: { square: 0.011, rectangle: 0.016 },
      medium: { square: 0.042, rectangle: 0.063 },
      high: { square: 0.167, rectangle: 0.25 },
    },
    retiresOn: '2026-10-23',
  },
]

export const DEFAULT_MODEL: ImageModel = 'gpt-image-1.5'

export function findModel(id: string): ModelInfo | null {
  return MODELS.find((model) => model.id === id) ?? null
}

/** True once the retirement date has passed, so the UI can stop offering it. */
export function isRetired(model: ModelInfo, now = new Date()): boolean {
  return model.retiresOn ? new Date(model.retiresOn).getTime() <= now.getTime() : false
}

/**
 * Estimated dollars for one image.
 *
 * Null means "we do not have a price for this", not "free". Callers must render
 * the difference rather than falling back to zero.
 */
export function estimateCost(
  modelId: string,
  quality: ImageQuality,
  size: ImageSize,
  count = 1,
): number | null {
  const model = findModel(modelId)
  if (!model?.price) return null

  const band = model.price[quality]
  if (!band) return null

  const unit = size === '1024x1024' ? band.square : band.rectangle
  return Math.round(unit * count * 10_000) / 10_000
}

/** Dollars as `$0.034`, or `—` for an unknown price. Never `$0.00` for unknown. */
export function formatCost(dollars: number | null): string {
  if (dollars === null) return '—'
  if (dollars === 0) return '$0.00'
  return dollars < 0.01 ? `$${dollars.toFixed(4)}` : `$${dollars.toFixed(2)}`
}
