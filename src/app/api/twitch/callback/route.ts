import { NextResponse, type NextRequest } from 'next/server'

import { siteUrl, twitchCredentials } from '@/lib/env'
import { exchangeCode, getCurrentUser } from '@/lib/providers/twitch/api'
import { twitchRedirectUri } from '@/lib/providers/twitch/config'
import { consumeState } from '@/lib/providers/twitch/oauth-state'
import { saveConnection } from '@/lib/services/connected-account-service'

/**
 * Completes the Twitch connection.
 *
 * Order matters: the state is validated **before** the code is exchanged, so a
 * forged callback never causes a token request at all.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const settings = `${siteUrl()}/integrations/twitch`

  const fail = (reason: string) => NextResponse.redirect(`${settings}?error=${reason}`)

  // The creator pressed Cancel on Twitch's consent screen.
  const denied = searchParams.get('error')
  if (denied) {
    await consumeState(searchParams.get('state'))
    return NextResponse.redirect(`${settings}?error=denied`)
  }

  const stateOk = await consumeState(searchParams.get('state'))
  if (!stateOk) return fail('bad_state')

  const code = searchParams.get('code')
  if (!code) return fail('no_code')

  const credentials = twitchCredentials()
  if (!credentials) return fail('not_configured')

  try {
    const tokens = await exchangeCode({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      code,
      redirectUri: twitchRedirectUri(),
    })

    const user = await getCurrentUser({
      accessToken: tokens.accessToken,
      clientId: credentials.clientId,
    })

    saveConnection({
      provider: 'twitch',
      providerUserId: user.id,
      displayName: user.display_name,
      username: user.login,
      avatarUrl: user.profile_image_url || null,
      tokens,
      metadata: { broadcasterType: user.broadcaster_type },
    })

    return NextResponse.redirect(`${settings}?connected=1`)
  } catch (error) {
    // Log the shape of the failure, never the code or the tokens.
    console.error(
      '[twitch] connection failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    return fail('exchange_failed')
  }
}
