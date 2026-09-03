import 'server-only'

import {
  TwitchApiError,
  getChannel,
  getFollowers,
  getStream,
} from '@/lib/providers/twitch/api'
import {
  ReconnectRequiredError,
  getAccessToken,
  getAccount,
} from '@/lib/services/connected-account-service'

/**
 * Twitch data for the dashboard.
 *
 * Everything here can fail — the token can be stale, Twitch can be down, the
 * machine can be offline. None of that should break a page, so failures come
 * back as a described state rather than an exception. A dashboard that renders
 * "couldn't reach Twitch" is useful; one that 500s during a stream is not.
 */

export type ChannelSnapshot = {
  status: 'ok'
  displayName: string
  login: string
  avatarUrl: string | null
  followerCount: number
  /** Empty when the token lacks moderator:read:followers, not when there are none. */
  recentFollowers: { userName: string; followedAt: string }[]
  canSeeFollowers: boolean
  live:
    | { isLive: true; title: string; gameName: string; viewerCount: number; startedAt: string }
    | { isLive: false }
  channelTitle: string | null
  channelGame: string | null
}

export type ChannelState =
  | ChannelSnapshot
  | { status: 'not_connected' }
  | { status: 'needs_reconnect'; message: string }
  | { status: 'unavailable'; message: string }

/**
 * Reads the current state of the connected Twitch channel.
 *
 * Four Helix calls, run together — they are independent, and doing them in
 * sequence would triple the dashboard's load time for no reason.
 */
export async function getChannelState(): Promise<ChannelState> {
  const account = getAccount('twitch')
  if (!account) return { status: 'not_connected' }

  try {
    const { accessToken, clientId } = await getAccessToken('twitch')
    const auth = { accessToken, clientId }
    const broadcasterId = account.providerUserId

    const [channel, stream, followers] = await Promise.all([
      getChannel(auth, broadcasterId),
      getStream(auth, broadcasterId),
      getFollowers(auth, broadcasterId),
    ])

    return {
      status: 'ok',
      displayName: account.displayName ?? account.username ?? 'Unknown',
      login: account.username ?? '',
      avatarUrl: account.avatarUrl,
      followerCount: followers.total,
      recentFollowers: followers.data.map((follower) => ({
        userName: follower.user_name,
        followedAt: follower.followed_at,
      })),
      canSeeFollowers: account.scopes.includes('moderator:read:followers'),
      live: stream
        ? {
            isLive: true,
            title: stream.title,
            gameName: stream.game_name,
            viewerCount: stream.viewer_count,
            startedAt: stream.started_at,
          }
        : { isLive: false },
      channelTitle: channel?.title || null,
      channelGame: channel?.game_name || null,
    }
  } catch (error) {
    if (error instanceof ReconnectRequiredError) {
      return { status: 'needs_reconnect', message: error.message }
    }

    if (error instanceof TwitchApiError) {
      return {
        status: 'unavailable',
        message: error.isAuthError
          ? 'Twitch rejected the stored credentials. Reconnect to fix it.'
          : 'Could not reach Twitch just now.',
      }
    }

    console.error('[twitch] channel state failed:', error)
    return { status: 'unavailable', message: 'Could not reach Twitch just now.' }
  }
}
