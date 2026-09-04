'use server'

import { revalidatePath } from 'next/cache'

import { stopTwitchListener } from '@/lib/providers/twitch/eventsub'
import { disconnect } from '@/lib/services/connected-account-service'

export async function disconnectTwitch(): Promise<void> {
  // Stop first: a listener holding a token we are about to revoke would spend
  // the next minute reconnecting against credentials that no longer work.
  stopTwitchListener()
  await disconnect('twitch')
  revalidatePath('/', 'layout')
}
