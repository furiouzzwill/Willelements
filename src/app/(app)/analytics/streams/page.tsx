import type { Metadata } from 'next'

import { formatDuration, StatGrid, StatTile } from '@/components/analytics/stat-tile'
import { WindowTabs } from '@/components/analytics/window-tabs'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { parseWindow, streamsReport, WINDOW_LABELS } from '@/lib/services/analytics-service'
import { isConnected } from '@/lib/services/connected-account-service'

export const metadata: Metadata = { title: 'Streams' }

/**
 * Your streams, reconstructed from the events that marked them.
 *
 * A session is a `stream.online` paired with the next `stream.offline`. That
 * pairing is only as complete as the app's uptime — it is not running when the
 * machine is off — so a session can be missing either half. Those are shown as
 * unknown rather than filled in, and a stream that ended while the app was
 * closed never quietly becomes a 96-hour marathon.
 */
export default async function StreamsPage({ searchParams }: PageProps<'/analytics/streams'>) {
  const params = await searchParams
  const window = parseWindow(params.window)
  const report = streamsReport(window)
  const twitchConnected = isConnected('twitch')

  return (
    <>
      <PageHeader
        title="Streams"
        description="Every session this app was running for."
        action={<WindowTabs current={window} basePath="/analytics/streams" />}
      />

      {report.sessions.length === 0 ? (
        <Panel>
          <PanelHeader title="No streams recorded" />
          <EmptyState
            title={twitchConnected ? 'Nothing in this window' : 'Twitch is not connected'}
            description={
              twitchConnected
                ? 'A stream is recorded when the app is running as you go live. Sessions from before you connected are not counted, because nothing was there to see them.'
                : 'Connect your channel and each stream will be recorded here.'
            }
          />
        </Panel>
      ) : (
        <>
          <Panel>
            <PanelHeader
              title="Summary"
              description={`${WINDOW_LABELS[window]} · finished streams only`}
            />
            <StatGrid>
              <StatTile label="Streams" value={report.sessions.length} hint="Sessions recorded" />
              <StatTile
                label="Average length"
                value={report.averageDurationMs}
                format="duration"
                hint={report.finishedCount > 0 ? `Over ${report.finishedCount} finished` : 'None finished yet'}
              />
              <StatTile
                label="Longest"
                value={report.longestDurationMs}
                format="duration"
                hint="Single session"
              />
              <StatTile
                label="Total streamed"
                value={report.totalDurationMs}
                format="duration"
                hint="Finished sessions"
              />
            </StatGrid>
          </Panel>

          <Panel>
            <PanelHeader title="Sessions" description="Newest first" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th scope="col" className="px-5 py-3 font-medium text-ink-subtle">
                      Started
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium text-ink-subtle">
                      Ended
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium text-ink-subtle">
                      Length
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-medium text-ink-subtle">
                      Events
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.sessions.map((session) => (
                    <tr key={session.startedAt} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-3 text-ink">{formatDateTime(session.startedAt)}</td>
                      <td className="px-5 py-3 text-ink-muted">
                        {session.live ? (
                          <span className="text-live">Live now</span>
                        ) : session.endedAt ? (
                          formatDateTime(session.endedAt)
                        ) : (
                          <span className="text-ink-subtle">Not recorded</span>
                        )}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-ink-muted">
                        {session.durationMs === null ? (
                          <span className="text-ink-subtle">—</span>
                        ) : (
                          formatDuration(session.durationMs)
                        )}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-ink">
                        {session.eventCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-5 py-3 text-xs text-ink-subtle">
              A dash means the app was not running when that stream ended, so its length is
              unknown. It is left unknown rather than measured against now.
            </p>
          </Panel>
        </>
      )}
    </>
  )
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
