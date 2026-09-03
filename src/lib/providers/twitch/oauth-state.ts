import 'server-only'

import crypto from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * CSRF protection for the OAuth round trip.
 *
 * A random value is generated when the creator starts connecting, stored in an
 * HTTP-only cookie, and compared when Twitch redirects back. Without this,
 * anyone could hand the callback a code of their own choosing and attach a
 * different Twitch account to this install.
 *
 * The cookie is short-lived and single-use — it is cleared as soon as the
 * callback reads it, whether the comparison passes or fails.
 */

const COOKIE = 'twitch_oauth_state'
const MAX_AGE_SECONDS = 10 * 60

export async function issueState(): Promise<string> {
  const state = crypto.randomBytes(16).toString('base64url')
  const store = await cookies()

  store.set(COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax', // must survive the top-level redirect back from Twitch
    path: '/',
    maxAge: MAX_AGE_SECONDS,
    // The app is served over http on localhost, so Secure would drop the cookie.
    secure: false,
  })

  return state
}

/**
 * Compares the returned state against the stored one and clears it.
 *
 * Uses a timing-safe comparison — cheap here, and the habit is worth keeping.
 */
export async function consumeState(returned: string | null): Promise<boolean> {
  const store = await cookies()
  const expected = store.get(COOKIE)?.value ?? null

  store.delete(COOKIE)

  if (!expected || !returned) return false
  if (expected.length !== returned.length) return false

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(returned))
}
