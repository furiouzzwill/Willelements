'use server'

import { revalidatePath } from 'next/cache'

import { probeToolchain } from '@/lib/hyperframes/toolchain'
import { renderRequest } from '@/lib/schemas/render'
import {
  RenderError,
  cancelRenderJob,
  createRenderJob,
  deleteRenderJob,
} from '@/lib/services/render-service'

export type RenderFormState = { error?: string; message?: string }

const PATH = '/create/animations'

export async function startRender(
  _prev: RenderFormState,
  formData: FormData,
): Promise<RenderFormState> {
  const parsed = renderRequest.safeParse({
    templateId: formData.get('templateId'),
    quality: formData.get('quality'),
    headline: formData.get('headline'),
    subhead: formData.get('subhead'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the values and try again.' }
  }

  try {
    const job = createRenderJob(parsed.data)
    revalidatePath(PATH)
    return { message: `Queued "${job.name}".` }
  } catch (error) {
    if (error instanceof RenderError) return { error: error.message }
    console.error('[render] could not queue a job', error)
    return { error: 'That render could not be queued.' }
  }
}

export async function cancelRender(formData: FormData): Promise<void> {
  const id = formData.get('id')
  if (typeof id === 'string') cancelRenderJob(id)
  revalidatePath(PATH)
}

export async function removeRender(formData: FormData): Promise<void> {
  const id = formData.get('id')
  if (typeof id === 'string') await deleteRenderJob(id)
  revalidatePath(PATH)
}

/**
 * Re-runs the toolchain probe.
 *
 * Slow on purpose — it launches the CLI, and on a first run that means npx
 * fetching it. The button that calls this says so.
 */
export async function recheckToolchain(): Promise<void> {
  await probeToolchain({ refresh: true })
  revalidatePath(PATH)
}
