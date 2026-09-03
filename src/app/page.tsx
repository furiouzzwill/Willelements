import { redirect } from 'next/navigation'

import { needsOnboarding } from '@/lib/services/setup-service'

/**
 * Whether setup is needed depends on live database state, so this must run per
 * request — a prerendered redirect would send everyone to whichever branch was
 * true at build time.
 */
export const dynamic = 'force-dynamic'

/** Local app — no marketing page, no sign-in. Straight to setup or the dashboard. */
export default function RootPage() {
  redirect(needsOnboarding() ? '/welcome' : '/dashboard')
}
