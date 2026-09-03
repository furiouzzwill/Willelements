/**
 * Environment configuration.
 *
 * This app runs locally on one machine, for one person. There is no hosted
 * backend and no account, so nothing here is required to start it — you can
 * `npm run dev` with an empty environment and the app works. Keys are only
 * needed as you reach the phase that uses them.
 *
 * Two rules still hold, and always will:
 *  1. Anything reachable from the browser is prefixed `NEXT_PUBLIC_`.
 *  2. Provider secrets are read on the server, lazily, and never logged.
 */

/** Where the database and asset files live. Copy this directory to back up. */
export function dataDir(): string | undefined {
  return process.env.WILLELEMENTS_DATA_DIR
}

/**
 * The origin OBS should use for browser sources, and that providers redirect
 * back to during OAuth. Defaults to the local dev server.
 */
export function siteUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/** Twitch OAuth credentials — needed from Phase 4. */
export function twitchCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function isTwitchConfigured(): boolean {
  return twitchCredentials() !== null
}

/**
 * Key used to encrypt provider tokens at rest in the local database.
 *
 * Generated on first run and stored in the data directory rather than in the
 * repository, so a copied database is not readable without it.
 */
export function tokenEncryptionKey(): string | undefined {
  return process.env.TOKEN_ENCRYPTION_KEY
}
