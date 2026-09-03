import 'server-only'

import { z } from 'zod'

/**
 * Twitch API client.
 *
 * Endpoints and parameters here were verified against the official docs at
 * dev.twitch.tv rather than remembered. See docs/twitch-integration.md for the
 * checklist and the dates.
 *
 * This module knows only how to talk to Twitch. Storage, encryption and refresh
 * scheduling live in `connected-account-service` — keeping them apart is what
 * lets YouTube slot in beside this later without touching either.
 */

const ID_BASE = 'https://id.twitch.tv/oauth2'
const HELIX_BASE = 'https://api.twitch.tv/helix'

/**
 * Scopes we request.
 *
 * `moderator:read:followers` is the whole list, and it buys two things: the
 * follower count, and the `channel.follow` (v2) EventSub subscription that
 * Phase 7 needs. Everything else waits until a feature actually needs it —
 * a consent screen that asks for subscriptions and chat before either works
 * is asking the creator to grant on trust.
 */
export const TWITCH_SCOPES = ['moderator:read:followers'] as const

export class TwitchApiError extends Error {
  readonly status: number
  /** True when the token is rejected — the caller should refresh or reconnect. */
  readonly isAuthError: boolean

  constructor(message: string, status: number, isAuthError: boolean) {
    super(message)
    this.name = 'TwitchApiError'
    this.status = status
    this.isAuthError = isAuthError
  }
}

/** Builds the URL a creator is sent to in order to authorise this app. */
export function authorizeUrl(options: {
  clientId: string
  redirectUri: string
  state: string
  forceVerify?: boolean
}): string {
  const url = new URL(`${ID_BASE}/authorize`)
  url.searchParams.set('client_id', options.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', options.redirectUri)
  url.searchParams.set('scope', TWITCH_SCOPES.join(' '))
  url.searchParams.set('state', options.state)
  if (options.forceVerify) url.searchParams.set('force_verify', 'true')
  return url.toString()
}

const tokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.array(z.string()).default([]),
  token_type: z.string(),
})

export type TwitchTokens = {
  accessToken: string
  refreshToken: string
  scopes: string[]
  expiresAt: Date
}

function toTokens(raw: z.infer<typeof tokenResponse>): TwitchTokens {
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    scopes: raw.scope,
    expiresAt: new Date(Date.now() + raw.expires_in * 1000),
  }
}

async function postForm(path: string, body: Record<string, string>) {
  const response = await fetch(`${ID_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
    cache: 'no-store',
  })

  if (!response.ok) {
    // Never include the body — it can echo the code or refresh token back.
    throw new TwitchApiError(
      `Twitch rejected the token request (${response.status}).`,
      response.status,
      response.status === 400 || response.status === 401,
    )
  }

  return response.json()
}

/** Exchanges the authorization code for tokens. */
export async function exchangeCode(options: {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
}): Promise<TwitchTokens> {
  const raw = await postForm('/token', {
    client_id: options.clientId,
    client_secret: options.clientSecret,
    code: options.code,
    grant_type: 'authorization_code',
    redirect_uri: options.redirectUri,
  })

  return toTokens(tokenResponse.parse(raw))
}

/**
 * Refreshes an access token.
 *
 * Twitch returns a **new refresh token**, which may differ from the one sent.
 * The caller must persist it: keeping the old one works exactly once and then
 * the connection dies with no obvious cause.
 */
export async function refreshTokens(options: {
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<TwitchTokens> {
  const raw = await postForm('/token', {
    client_id: options.clientId,
    client_secret: options.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: options.refreshToken,
  })

  return toTokens(tokenResponse.parse(raw))
}

/** Best-effort revocation on disconnect. Failure is not worth surfacing. */
export async function revokeToken(clientId: string, token: string): Promise<void> {
  try {
    await fetch(`${ID_BASE}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, token }).toString(),
      cache: 'no-store',
    })
  } catch {
    // The local record is removed regardless; the token expires on its own.
  }
}

async function helix<T>(
  path: string,
  options: { accessToken: string; clientId: string; schema: z.ZodType<T> },
): Promise<T> {
  const response = await fetch(`${HELIX_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Client-Id': options.clientId,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new TwitchApiError(
      `Twitch API request failed (${response.status}).`,
      response.status,
      response.status === 401,
    )
  }

  return options.schema.parse(await response.json())
}

const usersResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      login: z.string(),
      display_name: z.string(),
      profile_image_url: z.string().default(''),
      description: z.string().default(''),
      broadcaster_type: z.string().default(''),
    }),
  ),
})

export type TwitchUser = z.infer<typeof usersResponse>['data'][number]

/** The authenticated user. No parameters means "whoever this token belongs to". */
export async function getCurrentUser(auth: {
  accessToken: string
  clientId: string
}): Promise<TwitchUser> {
  const result = await helix('/users', { ...auth, schema: usersResponse })
  const user = result.data[0]
  if (!user) throw new TwitchApiError('Twitch returned no user for this token.', 200, true)
  return user
}

const channelResponse = z.object({
  data: z.array(
    z.object({
      broadcaster_id: z.string(),
      broadcaster_name: z.string(),
      game_name: z.string().default(''),
      title: z.string().default(''),
      tags: z.array(z.string()).default([]),
    }),
  ),
})

export type TwitchChannel = z.infer<typeof channelResponse>['data'][number]

export async function getChannel(
  auth: { accessToken: string; clientId: string },
  broadcasterId: string,
): Promise<TwitchChannel | null> {
  const result = await helix(`/channels?broadcaster_id=${broadcasterId}`, {
    ...auth,
    schema: channelResponse,
  })
  return result.data[0] ?? null
}

const streamsResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      game_name: z.string().default(''),
      title: z.string().default(''),
      viewer_count: z.number().int().nonnegative(),
      started_at: z.string(),
      thumbnail_url: z.string().default(''),
    }),
  ),
})

export type TwitchStream = z.infer<typeof streamsResponse>['data'][number]

/** The live stream, or null when offline. An empty array means offline. */
export async function getStream(
  auth: { accessToken: string; clientId: string },
  userId: string,
): Promise<TwitchStream | null> {
  const result = await helix(`/streams?user_id=${userId}`, {
    ...auth,
    schema: streamsResponse,
  })
  return result.data[0] ?? null
}

const followersResponse = z.object({
  total: z.number().int().nonnegative(),
  data: z
    .array(
      z.object({
        user_id: z.string(),
        user_name: z.string(),
        user_login: z.string(),
        followed_at: z.string(),
      }),
    )
    .default([]),
})

export type TwitchFollowers = z.infer<typeof followersResponse>

/**
 * Follower count, and the most recent followers.
 *
 * `total` comes back regardless of scope. The `data` array is only populated
 * when the token carries `moderator:read:followers` and belongs to the
 * broadcaster or one of their moderators — so an empty list here means "not
 * authorised to see them", not "no followers".
 */
export async function getFollowers(
  auth: { accessToken: string; clientId: string },
  broadcasterId: string,
  limit = 5,
): Promise<TwitchFollowers> {
  return helix(`/channels/followers?broadcaster_id=${broadcasterId}&first=${limit}`, {
    ...auth,
    schema: followersResponse,
  })
}
