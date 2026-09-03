import { createBrowserClient } from '@supabase/ssr'

import { publicEnv } from '@/lib/env'

/**
 * Supabase client for Client Components. Uses the publishable key, which is
 * safe to ship to the browser — every table it can reach is protected by RLS.
 */
export function createClient() {
  const env = publicEnv()
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
}
