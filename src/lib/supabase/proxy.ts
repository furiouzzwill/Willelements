import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { isSupabaseConfigured, publicEnv } from '@/lib/env'

/**
 * Refreshes the Supabase session on every matched request and writes the
 * rotated auth cookies onto the response.
 *
 * Server Components cannot set cookies, so without this the access token would
 * silently expire mid-session. `getClaims()` verifies the JWT signature (and
 * refreshes the session first if the token is close to expiring), which is why
 * Supabase recommends it over `getSession()` for anything security-relevant.
 *
 * This is an *optimistic* check only. Every protected page still resolves the
 * user through `requireUser()` in the data access layer, and every row is
 * additionally protected by RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (!isSupabaseConfigured()) {
    return { response, isAuthenticated: false }
  }

  const env = publicEnv()

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const { data } = await supabase.auth.getClaims()

  // Auth cookies must never be cached by a CDN — one user's session would
  // otherwise be served to the next visitor.
  response.headers.set('Cache-Control', 'no-store, max-age=0')

  return { response, isAuthenticated: Boolean(data?.claims?.sub) }
}
