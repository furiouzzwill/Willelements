import type { Metadata } from 'next'

import { ActivityChart } from '@/components/analytics/activity-chart'
import { BreakdownBars } from '@/components/analytics/breakdown-bars'
import { StatGrid, StatTile } from '@/components/analytics/stat-tile'
import { WindowTabs } from '@/components/analytics/window-tabs'
import { PageHeader } from '@/components/shell/page-header'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { analyticsSummary, parseWindow, WINDOW_LABELS } from '@/lib/services/analytics-service'
import { getChannelState } from '@/lib/services/twitch-service'

export const metadata: Metadata = { title: 'Twitch analytics' }

/**
 * Twitch on its own.
 *
 * Scoped to `provider = 'twitch'` rather than reusing the overview's figures,
 * so this page stays honest the day a second provider starts writing events.
 * Follower count comes from Twitch's API; everything else is counted from the
 * events we recorded. The page says which is which, because they can disagree
 * — the API knows about follows from before this app existed, and the event
 * table only knows what it watched happen.
 */
export default async function TwitchAnalyticsPage({
  searchParams,
}: PageProps<'/analytics/twitch'>) {
  const params = await searchParams
  const window = parseWindow(params.window)
  const summary = analyticsSummary(window, 'twitch')
  const channel = await getChannelState()

  if (channel.status !== 'ok') {
    return (
      <>
        <PageHeader title="Twitch" description="Your Twitch channel, measured." />
        <Panel>
          <PanelHeader title="Twitch is not connected" />
          <EmptyState
            title={channel.status === 'needs_reconnect' ? 'Reconnect Twitch' : 'Connect Twitch'}
            description={
              channel.status === 'needs_reconnect'
                ? 'The stored token could not be used. Reconnecting restores the numbers on this page.'
                : 'Connect your channel and this page fills in with real figures.'
            }
            action={
              <ButtonLink href="/integrations/twitch" size="sm">
                {channel.status === 'needs_reconnect' ? 'Reconnect' : 'Connect Twitch'}
              </ButtonLink>
            }
          />
        </Panel>
      </>
    )
  }

  const followEvents = summary.totals.find((total) => total.type === 'channel.follow')?.count ?? 0

  return (
    <>
      <PageHeader
        title="Twitch"
        description={`${channel.displayName} · counted from Twitch alone.`}
        action={<WindowTabs current={window} basePath="/analytics/twitch" />}
      />

      <Panel>
        <PanelHeader title="Channel" description="Reported by Twitch right now" />
        <StatGrid>
          <StatTile
            label="Followers"
            value={channel.canSeeFollowers ? channel.followerCount : null}
            hint={channel.canSeeFollowers ? 'Total, from Twitch' : 'Reconnect to read'}
          />
          <StatTile
            label="Status"
            value={channel.live.isLive ? 1 : 0}
            hint={channel.live.isLive ? 'Live now' : 'Offline'}
          />
          <StatTile
            label="Viewers"
            value={channel.live.isLive ? channel.live.viewerCount : null}
            hint={channel.live.isLive ? 'Watching now' : 'Not live'}
          />
          <StatTile
            label="Follows seen"
            value={followEvents}
            hint={`Recorded here · ${WINDOW_LABELS[window].toLowerCase()}`}
          />
        </StatGrid>
        <p className="border-t border-line px-5 py-3 text-xs text-ink-subtle">
          Followers is Twitch&apos;s own total and includes everyone who followed before this app
          ran. Follows seen counts only what arrived while it was listening, so the two are
          expected to differ rather than reconciled into one number.
        </p>
      </Panel>

      {summary.empty ? (
        <Panel>
          <PanelHeader title="No Twitch events recorded yet" />
          <EmptyState
            title="Nothing counted yet"
            description="Follows, subs, raids and cheers appear here as they happen. Test events never count."
          />
        </Panel>
      ) : (
        <>
          <Panel>
            <PanelHeader
              title="Activity"
              description={`Twitch events per day · ${WINDOW_LABELS[window].toLowerCase()}`}
            />
            <ActivityChart
              points={summary.series}
              label={`Twitch events per day, ${WINDOW_LABELS[window].toLowerCase()}`}
            />
          </Panel>

          <Panel>
            <PanelHeader title="By type" description={WINDOW_LABELS[window]} />
            <BreakdownBars
              rows={summary.totals.map((total) => ({
                key: total.type,
                label: total.label,
                value: total.count,
              }))}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Support" description={WINDOW_LABELS[window]} />
            <StatGrid>
              <StatTile label="Bits" value={summary.support.bits} hint="Cheered" />
              <StatTile
                label="Raid viewers"
                value={summary.support.raidViewers}
                hint="Brought by raids"
              />
              <StatTile label="Gifted subs" value={summary.support.giftedSubs} hint="Given" />
              <StatTile label="Events" value={summary.total} hint="Total recorded" />
            </StatGrid>
          </Panel>
        </>
      )}
    </>
  )
}
