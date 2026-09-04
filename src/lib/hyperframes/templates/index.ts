import { logoSting } from '@/lib/hyperframes/templates/logo-sting'
import { lowerThird } from '@/lib/hyperframes/templates/lower-third'
import { sceneCard } from '@/lib/hyperframes/templates/scene-card'
import type { CompositionTemplate } from '@/lib/hyperframes/templates/types'

/**
 * Every composition this app can generate.
 *
 * Order is the order they appear in the UI: the animated logo first, because it
 * is the one asset every brand needs and the one that proves the pipeline.
 */
export const COMPOSITION_TEMPLATES: CompositionTemplate[] = [logoSting, sceneCard, lowerThird]

export const TEMPLATE_IDS = COMPOSITION_TEMPLATES.map((template) => template.id)

export function findTemplate(id: string): CompositionTemplate | null {
  return COMPOSITION_TEMPLATES.find((template) => template.id === id) ?? null
}

export type { CompositionTemplate } from '@/lib/hyperframes/templates/types'
export type {
  CompositionContext,
  CompositionField,
  CompositionFormat,
  CompositionInput,
} from '@/lib/hyperframes/templates/types'
