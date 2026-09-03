'use server'

import { revalidatePath } from 'next/cache'

import { disconnect } from '@/lib/services/connected-account-service'

export async function disconnectTwitch(): Promise<void> {
  await disconnect('twitch')
  revalidatePath('/', 'layout')
}
