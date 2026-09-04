import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, afterEach, before, describe } from 'node:test'

/**
 * Twitch connection handling, against a stubbed Twitch.
 *
 * `fetch` is replaced so these run offline and deterministically. What is being
 * tested is our half of the contract — request shape, token rotation, failure
 * classification — not Twitch's behaviour.
 */

const workspace = mkdtempSync(path.join(tmpdir(), 'we-twitch-'))
process.env.WILLELEMENTS_DATA_DIR = workspace
process.env.TWITCH_CLIENT_ID = 'test-client-id'
process.env.TWITCH_CLIENT_SECRET = 'test-client-secret'

type AccountModule = typeof import('../src/lib/services/connected-account-service.ts')
type ApiModule = typeof import('../src/lib/providers/twitch/api.ts')
type DbModule = typeof import('../src/lib/db/index.ts')
type SchemaModule = typeof import('../src/lib/db/schema.ts')

let accounts: AccountModule
let api: ApiModule
let db: DbModule
let schema: SchemaModule

const realFetch = globalThis.fetch
const calls: { url: string; body: Record<string, string> }[] = []

/** Replaces fetch with a scripted response, recording what was sent. */
function stubFetch(handler: (url: string, body: Record<string, string>) => Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = Object.fromEntries(new URLSearchParams(String(init?.body ?? '')))
    calls.push({ url, body })
    return handler(url, body)
  }) as typeof fetch
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

before(async () => {
  accounts = await import('../src/lib/services/connected-account-service.ts')
  api = await import('../src/lib/providers/twitch/api.ts')
  db = await import('../src/lib/db/index.ts')
  schema = await import('../src/lib/db/schema.ts')
})

afterEach(() => {
  globalThis.fetch = realFetch
  calls.length = 0
})

after(() => {
  rmSync(workspace, { recursive: true, force: true })
})

function tokens(overrides: Partial<{ access: string; refresh: string; expiresInMs: number }> = {}) {
  return {
    accessToken: overrides.access ?? 'access-1',
    refreshToken: overrides.refresh ?? 'refresh-1',
    scopes: ['moderator:read:followers'],
    expiresAt: new Date(Date.now() + (overrides.expiresInMs ?? 4 * 60 * 60 * 1000)),
  }
}

describe('the authorize URL', () => {
  test('carries the parameters Twitch requires', () => {
    const url = new URL(
      api.authorizeUrl({
        clientId: 'abc',
        redirectUri: 'http://localhost:3000/api/twitch/callback',
        state: 'random-state',
      }),
    )

    assert.equal(url.origin + url.pathname, 'https://id.twitch.tv/oauth2/authorize')
    assert.equal(url.searchParams.get('response_type'), 'code')
    assert.equal(url.searchParams.get('client_id'), 'abc')
    assert.equal(url.searchParams.get('state'), 'random-state')
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'http://localhost:3000/api/twitch/callback',
    )
  })

  test('requests exactly the scopes the subscriptions need — no more', async () => {
    // Scopes are derived from the EventSub subscriptions rather than listed by
    // hand, so the consent screen and the feature set cannot drift apart.
    const { SUBSCRIPTIONS } = await import('../src/lib/providers/twitch/subscriptions.ts')

    const url = new URL(
      api.authorizeUrl({ clientId: 'a', redirectUri: 'http://localhost:3000/x', state: 's' }),
    )
    const requested = url.searchParams.get('scope')?.split(' ') ?? []
    const needed = [
      ...new Set(SUBSCRIPTIONS.map((s) => s.scope).filter((s): s is string => s !== null)),
    ]

    assert.deepEqual(requested.sort(), needed.sort())
    assert.ok(
      requested.includes('moderator:read:followers'),
      'follower alerts need this one',
    )
  })

  test('raids and stream online/offline need no scope at all', async () => {
    // Worth asserting: it means a connection is useful even to a creator who
    // grants nothing beyond the minimum.
    const { SUBSCRIPTIONS } = await import('../src/lib/providers/twitch/subscriptions.ts')
    const free = SUBSCRIPTIONS.filter((s) => s.scope === null).map((s) => s.eventType)

    assert.deepEqual(free.sort(), ['channel.raid', 'stream.offline', 'stream.online'])
  })
})

describe('storing a connection', () => {
  test('encrypts both tokens — neither is readable in the database', () => {
    accounts.saveConnection({
      provider: 'twitch',
      providerUserId: '12345',
      displayName: 'NightShift',
      username: 'nightshift',
      tokens: tokens(),
    })

    const row = db
      .getDb()
      .select()
      .from(schema.connectedAccounts)
      .all()[0]

    assert.ok(row.accessTokenEncrypted)
    assert.ok(!row.accessTokenEncrypted!.includes('access-1'), 'access token is encrypted')
    assert.ok(!row.refreshTokenEncrypted!.includes('refresh-1'), 'refresh token is encrypted')
  })

  test('the summary handed to the rest of the app contains no tokens', () => {
    const summary = accounts.getAccount('twitch')!
    const serialised = JSON.stringify(summary)

    assert.ok(!serialised.includes('access-1'))
    assert.ok(!serialised.includes('refresh-1'))
    assert.equal(summary.displayName, 'NightShift')
    assert.equal(summary.needsReconnect, false)
  })

  test('reconnecting replaces the connection rather than adding another', () => {
    accounts.saveConnection({
      provider: 'twitch',
      providerUserId: '12345',
      displayName: 'NightShift Gaming',
      username: 'nightshift',
      tokens: tokens({ access: 'access-2', refresh: 'refresh-2' }),
    })

    assert.equal(accounts.listAccounts().length, 1)
    assert.equal(accounts.getAccount('twitch')!.displayName, 'NightShift Gaming')
  })
})

describe('token refresh', () => {
  test('a token that is still valid is used without contacting Twitch', async () => {
    stubFetch(() => json({}, 500))

    const { accessToken } = await accounts.getAccessToken('twitch')

    assert.equal(accessToken, 'access-2')
    assert.equal(calls.length, 0, 'no refresh request should have been made')
  })

  test('persists the ROTATED refresh token, not the one it sent', async () => {
    // Twitch returns a new refresh token on every refresh. Storing the old one
    // works exactly once and then the connection dies for no visible reason.
    accounts.saveConnection({
      provider: 'twitch',
      providerUserId: '12345',
      username: 'nightshift',
      tokens: tokens({ access: 'expiring', refresh: 'refresh-old', expiresInMs: 1000 }),
    })

    stubFetch(() =>
      json({
        access_token: 'access-fresh',
        refresh_token: 'refresh-rotated',
        expires_in: 14400,
        scope: ['moderator:read:followers'],
        token_type: 'bearer',
      }),
    )

    const first = await accounts.getAccessToken('twitch')
    assert.equal(first.accessToken, 'access-fresh')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].body.grant_type, 'refresh_token')
    assert.equal(calls[0].body.refresh_token, 'refresh-old')

    // A second refresh must send the rotated token, proving it was stored.
    globalThis.fetch = realFetch
    calls.length = 0

    accounts.saveConnection({
      provider: 'twitch',
      providerUserId: '12345',
      username: 'nightshift',
      tokens: {
        accessToken: 'expiring-again',
        refreshToken: 'refresh-rotated',
        scopes: ['moderator:read:followers'],
        expiresAt: new Date(Date.now() + 1000),
      },
    })

    stubFetch(() =>
      json({
        access_token: 'access-fresher',
        refresh_token: 'refresh-rotated-2',
        expires_in: 14400,
        scope: ['moderator:read:followers'],
        token_type: 'bearer',
      }),
    )

    await accounts.getAccessToken('twitch')
    assert.equal(
      calls[0].body.refresh_token,
      'refresh-rotated',
      'the second refresh must use the rotated token from the first',
    )
  })

  test('refreshes ahead of expiry rather than waiting to be rejected', async () => {
    // Four minutes left is inside the margin — refresh now, not mid-alert.
    accounts.saveConnection({
      provider: 'twitch',
      providerUserId: '12345',
      username: 'nightshift',
      tokens: tokens({ access: 'nearly-done', refresh: 'r', expiresInMs: 4 * 60 * 1000 }),
    })

    stubFetch(() =>
      json({
        access_token: 'renewed',
        refresh_token: 'r2',
        expires_in: 14400,
        scope: ['moderator:read:followers'],
        token_type: 'bearer',
      }),
    )

    const { accessToken } = await accounts.getAccessToken('twitch')
    assert.equal(accessToken, 'renewed')
  })

  test('a rejected refresh asks for reconnection rather than throwing raw', async () => {
    accounts.saveConnection({
      provider: 'twitch',
      providerUserId: '12345',
      username: 'nightshift',
      tokens: tokens({ access: 'dead', refresh: 'revoked', expiresInMs: 1000 }),
    })

    stubFetch(() => json({ status: 400, message: 'Invalid refresh token' }, 400))

    await assert.rejects(
      () => accounts.getAccessToken('twitch'),
      (error: Error) => {
        assert.equal(error.name, 'ReconnectRequiredError')
        assert.match(error.message, /Reconnect/)
        return true
      },
    )
  })

  test('a token request failure never echoes the credential back', async () => {
    accounts.saveConnection({
      provider: 'twitch',
      providerUserId: '12345',
      username: 'nightshift',
      tokens: tokens({ access: 'x', refresh: 'sensitive-refresh-value', expiresInMs: 1000 }),
    })

    stubFetch(() => json({ message: 'refresh token sensitive-refresh-value is bad' }, 500))

    await assert.rejects(
      () => accounts.getAccessToken('twitch'),
      (error: Error) => {
        assert.ok(
          !error.message.includes('sensitive-refresh-value'),
          'error messages must not carry tokens into logs',
        )
        return true
      },
    )
  })
})

describe('disconnecting', () => {
  test('revokes with Twitch and removes the record', async () => {
    stubFetch(() => new Response(null, { status: 200 }))

    await accounts.disconnect('twitch')

    assert.equal(accounts.getAccount('twitch'), null)
    assert.equal(accounts.isConnected('twitch'), false)
    assert.ok(
      calls.some((call) => call.url.includes('/oauth2/revoke')),
      'the token should be revoked with Twitch, not just forgotten locally',
    )
  })

  test('disconnecting when nothing is connected is harmless', async () => {
    await accounts.disconnect('twitch')
  })
})
