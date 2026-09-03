import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { publicEnv } from '@/lib/env'

/**
 * Privileged Supabase client that bypasses Row Level Security.
 *
 * Only for trusted server-side work that genuinely cannot run as the user:
 * provider webhook ingestion (Twitch EventSub has no user session) and
 * background render workers.
 *
 * Rules:
 *  - Never import this from a Client Component. The `server-only` import above
 *    turns that into a build error.
 *  - Always scope queries by the owning `user_id` yourself; RLS is not doing
 *    it for you here.
 *
 * Prefers the new `sb_secret_…` key and falls back to the legacy service role
 * key, which Supabase is retiring.
 */
export function createAdminClient() {
  const secret =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!secret) {
    throw new Error(
      'SUPABASE_SECRET_KEY is not set. This key must never be exposed to the browser.',
    )
  }

  return createSupabaseClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
