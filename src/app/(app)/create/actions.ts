'use server'

import { revalidatePath } from 'next/cache'

import { imageRequest } from '@/lib/schemas/image'
import {
  generateForSubject,
  generatePackage,
  ImageServiceError,
} from '@/lib/services/image-service'

export type CreateFormState = { error?: string; message?: string }

/**
 * Generating costs money, so these actions never run speculatively.
 *
 * Both are plain form submissions rather than anything that could fire on a
 * render, a retry or a prefetch. The one place in this project where an
 * accidental extra call has a price attached is the one place to be least
 * clever about when calls happen.
 */

export async function generateOne(
  _prev: CreateFormState,
  formData: FormData,
): Promise<CreateFormState> {
  const parsed = imageRequest.safeParse({
    subjectId: formData.get('subjectId'),
    model: formData.get('model'),
    quality: formData.get('quality'),
    extra: formData.get('extra'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the values and try again.' }
  }

  try {
    const result = await generateForSubject(parsed.data)
    revalidatePath('/create')
    revalidatePath('/create/packages')

    return result.generation.status === 'succeeded'
      ? { message: 'Generated. It is in your asset library.' }
      : { error: result.generation.error ?? 'That did not generate.' }
  } catch (error) {
    if (error instanceof ImageServiceError) return { error: error.message }
    console.error('[images] generation failed', error)
    return { error: 'That image could not be generated.' }
  }
}

export async function generateStreamPackage(
  _prev: CreateFormState,
  formData: FormData,
): Promise<CreateFormState> {
  const parsed = imageRequest
    .omit({ subjectId: true })
    .safeParse({
      model: formData.get('model'),
      quality: formData.get('quality'),
      extra: formData.get('extra'),
    })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the values and try again.' }
  }

  try {
    const results = await generatePackage(parsed.data)
    revalidatePath('/create')
    revalidatePath('/create/packages')

    const failed = results.find((result) => result.generation.status === 'failed')
    const made = results.filter((result) => result.generation.status === 'succeeded').length

    if (failed) {
      return {
        error:
          made > 0
            ? `Made ${made} before stopping: ${failed.generation.error}`
            : (failed.generation.error ?? 'The package did not generate.'),
      }
    }

    return { message: `Generated ${made} pieces. They are in your asset library.` }
  } catch (error) {
    if (error instanceof ImageServiceError) return { error: error.message }
    console.error('[images] package failed', error)
    return { error: 'That package could not be generated.' }
  }
}
