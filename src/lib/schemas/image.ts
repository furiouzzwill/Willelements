import { z } from 'zod'

import { IMAGE_MODELS } from '@/lib/providers/openai/pricing'

/**
 * What a generation request is allowed to be.
 *
 * Validated on the way in like every other input in this project, but with a
 * sharper edge than most: a bad value here does not render wrong, it spends
 * money wrong. The model is checked against the known list rather than passed
 * through, so a typo cannot become a call to something unpriced.
 */

export const imageQuality = z.enum(['low', 'medium', 'high'])

export const imageRequest = z.object({
  subjectId: z.string().trim().min(1, 'Pick something to generate.'),
  model: z.enum(IMAGE_MODELS).prefault('gpt-image-1.5'),
  quality: imageQuality.prefault('medium'),
  /** Free text appended to the built prompt. Bounded so it cannot swamp it. */
  extra: z.string().trim().max(400).prefault(''),
})

export type ImageRequest = z.infer<typeof imageRequest>

export const QUALITY_LABELS: Record<z.infer<typeof imageQuality>, string> = {
  low: 'Low — quick look at a direction',
  medium: 'Medium — usable on stream',
  high: 'High — final artwork',
}
