import type { Metadata } from 'next'

import { ActivityChart } from '@/components/analytics/activity-chart'
import { BreakdownBars } from '@/components/analytics/breakdown-bars'
import { StatGrid, StatTile } from '@/components/analytics/stat-tile'
import { WindowTabs } from '@/components/analytics/window-tabs'
import { PageHeader } from '@/components/shell/page-header'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import {
  analyticsSummary,
  lastRealEventAt,
  parseWindow,
  WINDOW_LABELS,
} from '@/lib/services/analytics-service'
import { isConnected } from '@/lib/services/connected-account-service'

export const metadata: Metadata = { title: 'Analytics' }

export default async function AnalyticsPage({ searchParams }: PageProps<'/analytics'>) {
  const params = await searchParams
  const window = parseWindow(params.window)
  const summary = analyticsSummary(window)
  const twitchConnected = isConnected('twitch')
  const lastEvent = lastRealEventAt()

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Counted from what actually happened on your channel."
        action={<WindowTabs current={window} basePath="/analytics" />}
      />

      {summary.empty ? (
        <Panel>
          <PanelHeader title="Nothing to measure yet" />
          <EmptyState
            title={twitchConnected ? 'No events recorded yet' : 'Twitch is not connected'}
            description={
              twitchConnected
                ? 'Follows, subs, raids and cheers are counted here from the moment they happen. Nothing is estimated, so this stays empty until there is something real to show.'
                : 'Connect your channel and everything that happens on it will be counted here.'
            }
            action={
              twitchConnected ? undefined : (
                <ButtonLink href="/integrations/twitch" size="sm">
                  Connect Twitch
                </ButtonLink>
              )
            }
          />
        </Panel>
      ) : (
        <>
          <Panel>
            <PanelHeader
              title="Totals"
              description={`${WINDOW_LABELS[window]} · test events excluded`}
            />
            <StatGrid>
              <StatTile label="Events" value={summary.total} hint="Real events recorded" />
              <StatTile label="Bits" value={summary.support.bits} hint="Cheered" />
              <StatTile
                label="Raid viewers"
                value={summary.support.raidViewers}
                hint="Brought by raids"
              />
              <StatTile
                label="Gifted subs"
                value={summary.support.giftedSubs}
                hint="Given to the channel"
              />
            </StatGrid>
          </Panel>

          <Panel>
            <PanelHeader
              title="Activity"
              description={`Events per day · ${WINDOW_LABELS[window].toLowerCase()}`}
            />
            <ActivityChart
              points={summary.series}
              label={`Events per day, ${WINDOW_LABELS[window].toLowerCase()}`}
            />
          </Panel>

          <Panel>
            <PanelHeader title="By type" description="What made up that activity" />
            <BreakdownBars
              rows={summary.totals.map((total) => ({
                key: total.type,
                label: total.label,
                value: total.count,
              }))}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Where these numbers come from" />
            <dl className="space-y-3 px-5 py-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-muted">History starts</dt>
                <dd className="text-ink">
                  {summary.firstEventAt ? formatDateTime(summary.firstEventAt) : '—'}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-muted">Last event</dt>
                <dd className="text-ink">{lastEvent ? formatDateTime(lastEvent) : '—'}</dd>
              </div>
              <p className="border-t border-line pt-3 text-ink-subtle">
                Every figure is counted from events a provider actually sent. Test events are
                excluded, and providers are never added together — a combined total would be a
                number neither of them agrees with.
              </p>
            </dl>
          </Panel>
        </>
      )}
    </>
  )
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
