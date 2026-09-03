'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { STARTER_BRAND_NAME } from '@/lib/db/constants'
import { brandDna } from '@/lib/schemas/brand'
import { getDefaultBrand, updateBrand } from '@/lib/services/brand-service'

export type WelcomeState = { error?: string }

const input = z.object({
  name: z.string().trim().min(1, 'Give your brand a name.').max(80),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  style: z.string(),
})

/**
 * Completes first-run setup.
 *
 * Deliberately three fields. Everything else has a sensible default and is
 * better discovered in the Brand Studio than demanded up front — an onboarding
 * flow that asks for motion-style preferences before you have seen the product
 * is asking you to guess.
 */
export async function completeWelcome(
  _prev: WelcomeState,
  formData: FormData,
): Promise<WelcomeState> {
  const brand = getDefaultBrand()
  if (!brand) return { error: 'No brand to set up.' }

  const parsed = input.safeParse({
    name: formData.get('name'),
    primary: formData.get('primary'),
    background: formData.get('background'),
    style: formData.get('style'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the values and try again.' }
  }

  if (parsed.data.name === STARTER_BRAND_NAME) {
    return { error: 'Pick a name of your own so we know setup is done.' }
  }

  const dna = brandDna.parse({
    ...brand.dna,
    colors: {
      ...brand.dna.colors,
      primary: parsed.data.primary,
      background: parsed.data.background,
    },
    visualStyle: { ...brand.dna.visualStyle, style: parsed.data.style },
  })

  updateBrand(brand.id, { name: parsed.data.name, dna })
  revalidatePath('/', 'layout')
  redirect('/brand')
}
