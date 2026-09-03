import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import { publicEnv } from '@/lib/env'

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 *
 * `cookies()` is async in Next.js 16. Server Components are not allowed to
 * write cookies, so `setAll` is wrapped in a try/catch: session refresh is
 * handled by `src/proxy.ts`, and the failure here is expected and harmless.
 */
export async function createClient() {
  const env = publicEnv()
  const cookieStore = await cookies()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component — the proxy refreshes the session.
          }
        },
      },
    },
  )
}
