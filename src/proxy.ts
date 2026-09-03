import { NextResponse, type NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/proxy'

/**
 * Next.js 16 renamed Middleware to Proxy. Same runtime, same conventions.
 *
 * Two jobs, both deliberately cheap:
 *  1. Keep the Supabase session cookies fresh.
 *  2. Optimistically bounce signed-out visitors away from the app shell and
 *     signed-in creators away from the auth screens.
 *
 * Authorisation is *not* decided here. Pages call `requireUser()` and the
 * database enforces RLS; this only saves a round trip and a flash of the wrong
 * screen.
 */

const AUTH_ROUTES = ['/sign-in', '/sign-up', '/check-email']

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request)
  const { pathname, searchParams } = request.nextUrl

  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )

  if (!isAuthenticated && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    url.search = ''
    // Preserve where the creator was heading so we can return them after login.
    if (pathname !== '/') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthenticated && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = searchParams.get('next') ?? '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  /**
   * Runs on application routes only. Deliberately excluded:
   *  - `/` and the marketing pages, which are public and statically servable.
   *  - `/overlay/*`, the OBS browser sources. They authenticate with their own
   *    opaque overlay token (Phase 5) and must never depend on a creator's
   *    session cookie or pay the cost of a session refresh.
   *  - `/api/webhooks/*`, which is verified by provider signature (Phase 7).
   *  - Static assets and image optimisation.
   */
  matcher: [
    '/dashboard/:path*',
    '/stream/:path*',
    '/create/:path*',
    '/brand/:path*',
    '/analytics/:path*',
    '/activity/:path*',
    '/community/:path*',
    '/monetization/:path*',
    '/integrations/:path*',
    '/settings/:path*',
    '/sign-in',
    '/sign-up',
    '/check-email',
  ],
}
