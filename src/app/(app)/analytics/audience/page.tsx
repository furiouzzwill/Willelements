import type { Metadata } from 'next'

import { WindowTabs } from '@/components/analytics/window-tabs'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import {
  audienceReport,
  parseWindow,
  WINDOW_LABELS,
  type RecentActor,
  type Supporter,
} from '@/lib/services/analytics-service'
import { isConnected } from '@/lib/services/connected-account-service'

export const metadata: Metadata = { title: 'Audience' }

/**
 * The people, rather than the totals.
 *
 * Grouped by the provider's actor id, so someone who changes their display name
 * stays one person instead of appearing twice with half their bits each.
 */
export default async function AudiencePage({ searchParams }: PageProps<'/analytics/audience'>) {
  const params = await searchParams
  const window = parseWindow(params.window)
  const report = audienceReport(window)
  const twitchConnected = isConnected('twitch')

  return (
    <>
      <PageHeader
        title="Audience"
        description="Who showed up, and what they did."
        action={<WindowTabs current={window} basePath="/analytics/audience" />}
      />

      {report.empty ? (
        <Panel>
          <PanelHeader title="No audience data yet" />
          <EmptyState
            title={twitchConnected ? 'Nothing in this window' : 'Twitch is not connected'}
            description={
              twitchConnected
                ? 'People appear here as they follow, sub, raid and cheer. Nobody is inferred — this stays empty until someone does something.'
                : 'Connect your channel and the people in your chat will show up here.'
            }
          />
        </Panel>
      ) : (
        <>
          {/* items-start, so a short list keeps its own height instead of being
              stretched to match a long one beside it. */}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <SupporterPanel
              title="Top cheerers"
              description={`Bits · ${WINDOW_LABELS[window].toLowerCase()}`}
              rows={report.cheerers}
              unit="bits"
              empty="No cheers in this window."
            />
            <SupporterPanel
              title="Biggest raids"
              description={`Viewers brought · ${WINDOW_LABELS[window].toLowerCase()}`}
              rows={report.raiders}
              unit="viewers"
              empty="No raids in this window."
            />
            <SupporterPanel
              title="Top gifters"
              description={`Subs gifted · ${WINDOW_LABELS[window].toLowerCase()}`}
              rows={report.gifters}
              unit="subs"
              empty="No gifted subs in this window."
            />
            <Panel>
              <PanelHeader title="New followers" description="Most recent first" />
              <ActorList rows={report.recentFollowers} empty="No follows in this window." />
            </Panel>
          </div>

          <Panel>
            <PanelHeader title="New subscribers" description="Most recent first" />
            <ActorList rows={report.recentSubscribers} empty="No subscriptions in this window." />
          </Panel>
        </>
      )}
    </>
  )
}

function SupporterPanel({
  title,
  description,
  rows,
  unit,
  empty,
}: {
  title: string
  description: string
  rows: Supporter[]
  unit: string
  empty: string
}) {
  return (
    <Panel>
      <PanelHeader title={title} description={description} />
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-subtle">{empty}</p>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((row, index) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-4 shrink-0 text-xs tabular-nums text-ink-subtle">
                  {index + 1}
                </span>
                <span className="truncate text-sm text-ink">{row.name}</span>
              </span>
              <span className="shrink-0 text-right text-sm tabular-nums text-ink">
                {row.value.toLocaleString()}{' '}
                <span className="text-ink-subtle">{unit}</span>
                {row.occurrences > 1 ? (
                  <span className="ml-2 text-xs text-ink-subtle">×{row.occurrences}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

function ActorList({ rows, empty }: { rows: RecentActor[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="px-5 py-6 text-sm text-ink-subtle">{empty}</p>
  }

  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
          <span className="truncate text-sm text-ink">{row.name}</span>
          <time dateTime={row.occurredAt} className="shrink-0 text-xs text-ink-subtle">
            {new Date(row.occurredAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </time>
        </li>
      ))}
    </ul>
  )
}
