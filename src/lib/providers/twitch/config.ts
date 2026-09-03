import { siteUrl } from '@/lib/env'

/**
 * The OAuth redirect URI.
 *
 * Twitch matches this **exactly** against the value registered in the developer
 * console, so it is derived in one place: a trailing slash or a different port
 * between the two is the single most common reason a connection fails.
 *
 * Register this same string at https://dev.twitch.tv/console.
 */
export function twitchRedirectUri(): string {
  return `${siteUrl()}/api/twitch/callback`
}
