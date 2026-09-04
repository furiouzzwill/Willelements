import { z } from 'zod'

/**
 * Render requests and the stored record of one.
 *
 * A render is the only thing in this app that takes minutes and burns CPU, so
 * what it was asked to do is worth keeping: the row records the exact text and
 * quality it ran with, which is what makes "render that again, slightly
 * different" possible without guessing.
 */

export const RENDER_STATUSES = ['queued', 'processing', 'completed', 'failed', 'cancelled'] as const
export const renderStatus = z.enum(RENDER_STATUSES)
export type RenderStatus = z.infer<typeof renderStatus>

/** Terminal states — nothing further will happen to a job in one of these. */
export const FINISHED_STATUSES: RenderStatus[] = ['completed', 'failed', 'cancelled']

export const RENDER_QUALITIES = ['draft', 'standard', 'high'] as const
export const renderQuality = z.enum(RENDER_QUALITIES)
export type RenderQuality = z.infer<typeof renderQuality>

export const QUALITY_LABELS: Record<RenderQuality, string> = {
  draft: 'Draft — fastest, for checking the idea',
  standard: 'Standard — good enough to stream',
  high: 'High — final delivery',
}

/** The free text a composition was rendered with. Stored in `render_jobs.input`. */
export const compositionInput = z.object({
  headline: z.string().trim().max(120).prefault(''),
  subhead: z.string().trim().max(200).prefault(''),
})

export type CompositionInputValues = z.infer<typeof compositionInput>

export function defaultCompositionInput(): CompositionInputValues {
  return compositionInput.parse({})
}

/** What the animations page submits. The template id is checked by the service. */
export const renderRequest = z.object({
  templateId: z.string().trim().min(1, 'Pick a composition.'),
  quality: renderQuality.prefault('standard'),
  headline: z.string().trim().max(120).prefault(''),
  subhead: z.string().trim().max(200).prefault(''),
})

export type RenderRequest = z.infer<typeof renderRequest>
