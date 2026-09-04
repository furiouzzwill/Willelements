'use server'

import { revalidatePath } from 'next/cache'

import { clearActivity } from '@/lib/services/event-service'

export async function clearActivityAction(): Promise<void> {
  clearActivity()
  revalidatePath('/activity')
  revalidatePath('/dashboard')
}
