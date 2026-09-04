import { ButtonLink } from '@/components/ui/button'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import type { ChannelState } from '@/lib/services/twitch-service'

function since(startedAt: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(startedAt)) / 60000))
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/**
 * Live status from the connected channel.
 *
 * Every branch says something true. There is no branch that shows a number we
 * did not receive from Twitch — "unavailable" is a better answer than a stale
 * or invented figure, particularly on a screen someone glances at mid-stream.
 */
export function LiveStatus({ state }: { state: ChannelState }) {
  return (
    <Panel>
      <PanelHeader title="Live status" description="Your connected channel" />

      {state.status === 'not_connected' ? (
        <EmptyState
          title="No platform connected"
          description="Connect Twitch to see whether you're live, your follower count, and recent activity."
          action={
            <ButtonLink href="/integrations/twitch" size="sm">
              Connect Twitch
            </ButtonLink>
          }
        />
      ) : null}

      {state.status === 'needs_reconnect' ? (
        <EmptyState
          title="Reconnect needed"
          description={state.message}
          action={
            <ButtonLink href="/integrations/twitch" size="sm">
              Reconnect
            </ButtonLink>
          }
        />
      ) : null}

      {state.status === 'unavailable' ? (
        <EmptyState title="Twitch is not reachable" description={state.message} />
      ) : null}

      {state.status === 'ok' ? (
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={
                state.live.isLive
                  ? 'size-2.5 rounded-full bg-live shadow-[0_0_0_4px] shadow-live/20'
                  : 'size-2.5 rounded-full bg-line-strong'
              }
            />
            <span className="font-display text-lg font-semibold text-ink">
              {state.live.isLive ? 'Live now' : 'Offline'}
            </span>
            {state.live.isLive ? (
              <span className="text-sm text-ink-subtle">for {since(state.live.startedAt)}</span>
            ) : null}
          </div>

          {state.live.isLive ? (
            <div className="space-y-1">
              <p className="text-sm text-ink">{state.live.title || 'Untitled stream'}</p>
              <p className="text-sm text-ink-subtle">
                {state.live.gameName || 'No category'} ·{' '}
                {state.live.viewerCount.toLocaleString()} watching
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink-subtle">
              {state.channelTitle
                ? `Last set up as “${state.channelTitle}”`
                : 'Nothing scheduled.'}
            </p>
          )}

          <div className="border-t border-line pt-4">
            <p className="font-display text-2xl font-semibold text-ink">
              {state.followerCount.toLocaleString()}
            </p>
            <p className="text-sm text-ink-subtle">followers on Twitch</p>
          </div>
        </div>
      ) : null}
    </Panel>
  )
}
