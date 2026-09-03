import 'server-only'

import { eq } from 'drizzle-orm'

import { getDb } from '@/lib/db'
import { connectedAccounts, type ConnectedAccount } from '@/lib/db/schema'
import { seal, tryOpen } from '@/lib/crypto/secret-box'
import { twitchCredentials } from '@/lib/env'
import {
  TwitchApiError,
  refreshTokens,
  revokeToken,
  type TwitchTokens,
} from '@/lib/providers/twitch/api'

/**
 * Connected streaming platforms.
 *
 * A connected account is not an identity — this app has no accounts. It is a
 * channel the creator authorised us to read, and it can be disconnected without
 * affecting anything else they have made.
 *
 * Tokens are encrypted before they are written and decrypted only here. Nothing
 * outside this module ever handles a plaintext provider token, and no route,
 * page or log line returns one.
 */

export type Provider = 'twitch' | 'youtube'

/** What the rest of the app is allowed to see. Deliberately has no tokens. */
export type AccountSummary = {
  id: string
  provider: Provider
  providerUserId: string
  displayName: string | null
  username: string | null
  avatarUrl: string | null
  scopes: string[]
  connectedAt: string
  /** True when the stored tokens cannot be decrypted — reconnect required. */
  needsReconnect: boolean
}

/** Refresh this long before expiry rather than waiting to be rejected. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000

function scopesOf(row: ConnectedAccount): string[] {
  return Array.isArray(row.scopes) ? (row.scopes as string[]) : []
}

function summarise(row: ConnectedAccount): AccountSummary {
  return {
    id: row.id,
    provider: row.provider as Provider,
    providerUserId: row.providerUserId,
    displayName: row.displayName,
    username: row.username,
    avatarUrl: row.avatarUrl,
    scopes: scopesOf(row),
    connectedAt: row.connectedAt,
    needsReconnect: tryOpen(row.refreshTokenEncrypted) === null,
  }
}

function findRow(provider: Provider): ConnectedAccount | null {
  return (
    getDb()
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.provider, provider))
      .get() ?? null
  )
}

export function getAccount(provider: Provider): AccountSummary | null {
  const row = findRow(provider)
  return row ? summarise(row) : null
}

export function listAccounts(): AccountSummary[] {
  return getDb().select().from(connectedAccounts).all().map(summarise)
}

export function isConnected(provider: Provider): boolean {
  return findRow(provider) !== null
}

/**
 * Stores a connection, replacing any existing one for the provider.
 *
 * There is one row per provider (enforced by a unique index), because this is
 * a single-creator app — reconnecting should update the connection, not
 * accumulate stale ones.
 */
export function saveConnection(input: {
  provider: Provider
  providerUserId: string
  providerChannelId?: string | null
  displayName?: string | null
  username?: string | null
  avatarUrl?: string | null
  tokens: TwitchTokens
  metadata?: Record<string, unknown>
}): AccountSummary {
  const db = getDb()
  const now = new Date().toISOString()

  const values = {
    provider: input.provider,
    providerUserId: input.providerUserId,
    providerChannelId: input.providerChannelId ?? input.providerUserId,
    displayName: input.displayName ?? null,
    username: input.username ?? null,
    avatarUrl: input.avatarUrl ?? null,
    scopes: input.tokens.scopes,
    accessTokenEncrypted: seal(input.tokens.accessToken),
    refreshTokenEncrypted: seal(input.tokens.refreshToken),
    tokenExpiresAt: input.tokens.expiresAt.toISOString(),
    metadata: input.metadata ?? {},
    updatedAt: now,
  }

  const existing = findRow(input.provider)

  const row = existing
    ? db
        .update(connectedAccounts)
        .set(values)
        .where(eq(connectedAccounts.id, existing.id))
        .returning()
        .get()
    : db.insert(connectedAccounts).values(values).returning().get()

  return summarise(row)
}

/** Raised when a connection exists but can no longer be used. */
export class ReconnectRequiredError extends Error {
  readonly provider: Provider

  constructor(provider: Provider, message: string) {
    super(message)
    this.name = 'ReconnectRequiredError'
    this.provider = provider
  }
}

/**
 * Returns a usable access token, refreshing it first if it is close to expiring.
 *
 * Twitch issues a **new refresh token** on every refresh, so the rotated value
 * is persisted here. Keeping the old one would work exactly once and then fail
 * with nothing obvious to point at.
 */
export async function getAccessToken(
  provider: Provider,
): Promise<{ accessToken: string; clientId: string; account: ConnectedAccount }> {
  const row = findRow(provider)
  if (!row) throw new ReconnectRequiredError(provider, 'That platform is not connected.')

  if (provider !== 'twitch') {
    throw new Error(`No token handling implemented for ${provider} yet.`)
  }

  const credentials = twitchCredentials()
  if (!credentials) {
    throw new ReconnectRequiredError(provider, 'Twitch credentials are not configured.')
  }

  const accessToken = tryOpen(row.accessTokenEncrypted)
  const refreshToken = tryOpen(row.refreshTokenEncrypted)

  if (!refreshToken) {
    // Usually a changed or missing TOKEN_ENCRYPTION_KEY. Reconnecting fixes it.
    throw new ReconnectRequiredError(
      provider,
      'Stored credentials could not be read. Reconnect the platform.',
    )
  }

  const expiresAt = row.tokenExpiresAt ? Date.parse(row.tokenExpiresAt) : 0
  const stillValid = accessToken && expiresAt - Date.now() > REFRESH_MARGIN_MS

  if (stillValid) {
    return { accessToken, clientId: credentials.clientId, account: row }
  }

  let tokens: TwitchTokens
  try {
    tokens = await refreshTokens({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      refreshToken,
    })
  } catch (error) {
    if (error instanceof TwitchApiError && error.isAuthError) {
      // Twitch invalidates refresh tokens on password change or app disconnect.
      throw new ReconnectRequiredError(
        provider,
        'Twitch rejected the stored credentials. Reconnect the platform.',
      )
    }
    throw error
  }

  getDb()
    .update(connectedAccounts)
    .set({
      accessTokenEncrypted: seal(tokens.accessToken),
      // The rotated refresh token, not the one we sent.
      refreshTokenEncrypted: seal(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt.toISOString(),
      scopes: tokens.scopes,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(connectedAccounts.id, row.id))
    .run()

  return { accessToken: tokens.accessToken, clientId: credentials.clientId, account: row }
}

/** Disconnects, revoking the token with the provider before forgetting it. */
export async function disconnect(provider: Provider): Promise<void> {
  const row = findRow(provider)
  if (!row) return

  const credentials = twitchCredentials()
  const accessToken = tryOpen(row.accessTokenEncrypted)

  if (provider === 'twitch' && credentials && accessToken) {
    await revokeToken(credentials.clientId, accessToken)
  }

  getDb().delete(connectedAccounts).where(eq(connectedAccounts.id, row.id)).run()
}
