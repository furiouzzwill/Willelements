import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/env'

/**
 * Data access layer for authentication.
 *
 * Every protected page and Server Action resolves the current creator through
 * here rather than trusting the proxy redirect. `cache()` deduplicates the call
 * within a single render pass, so a layout and its page share one lookup.
 */

/**
 * Returns the verified user, or `null` when signed out. Never throws.
 *
 * A project with no Supabase configuration reads as signed out rather than
 * crashing, so a fresh clone lands on the sign-in screen with setup
 * instructions instead of a 500.
 */
export const getUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
})

/** Returns the verified user or redirects to sign-in. Use in protected routes. */
export async function requireUser(): Promise<User> {
  const user = await getUser()
  if (!user) redirect('/sign-in')
  return user
}

/**
 * Best-effort display name for the signed-in creator. Real profile data lands
 * in Phase 2 with the `profiles` table; until then this reads the auth
 * metadata captured at sign-up.
 */
export function displayNameFor(user: User): string {
  const metadata = user.user_metadata as { display_name?: unknown } | null
  const fromMetadata = metadata?.display_name
  if (typeof fromMetadata === 'string' && fromMetadata.trim()) {
    return fromMetadata.trim()
  }
  return user.email?.split('@')[0] ?? 'Creator'
}
