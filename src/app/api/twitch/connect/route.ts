import { NextResponse } from 'next/server'

import { siteUrl, twitchCredentials } from '@/lib/env'
import { authorizeUrl } from '@/lib/providers/twitch/api'
import { issueState } from '@/lib/providers/twitch/oauth-state'
import { twitchRedirectUri } from '@/lib/providers/twitch/config'

/** Starts the Twitch connection by sending the creator to Twitch to authorise. */
export async function GET() {
  const credentials = twitchCredentials()

  if (!credentials) {
    return NextResponse.redirect(`${siteUrl()}/integrations/twitch?error=not_configured`)
  }

  const state = await issueState()

  return NextResponse.redirect(
    authorizeUrl({
      clientId: credentials.clientId,
      redirectUri: twitchRedirectUri(),
      state,
    }),
  )
}
