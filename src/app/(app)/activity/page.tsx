import type { Metadata } from 'next'

import { clearActivityAction } from '@/app/(app)/activity/actions'
import { ActivityList } from '@/components/activity/activity-list'
import { ListenerStatusPanel } from '@/components/activity/listener-status'
import { PageHeader } from '@/components/shell/page-header'
import { Button, ButtonLink } from '@/components/ui/button'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { getListenerStatus } from '@/lib/providers/twitch/eventsub'
import { isConnected } from '@/lib/services/connected-account-service'
import { countEvents, listActivity } from '@/lib/services/event-service'

export const metadata: Metadata = { title: 'Activity' }

export default async function ActivityPage({ searchParams }: PageProps<'/activity'>) {
  const params = await searchParams
  const includeTests = params.tests === '1'

  const entries = listActivity({ limit: 100, includeTests })
  const realCount = countEvents()
  const twitchConnected = isConnected('twitch')
  const status = getListenerStatus()

  return (
    <>
      <PageHeader
        title="Activity"
        description="Everything that has happened on your connected channels."
        action={
          <ButtonLink
            href={includeTests ? '/activity' : '/activity?tests=1'}
            variant="secondary"
            size="sm"
          >
            {includeTests ? 'Hide test events' : 'Show test events'}
          </ButtonLink>
        }
      />

      <Panel>
        <PanelHeader title="Twitch connection" />
        {twitchConnected ? (
          <ListenerStatusPanel status={status} />
        ) : (
          <EmptyState
            title="Twitch is not connected"
            description="Connect your channel and events will start appearing here."
            action={
              <ButtonLink href="/integrations/twitch" size="sm">
                Connect Twitch
              </ButtonLink>
            }
          />
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title={includeTests ? 'All events' : 'Real events'}
          description={
            includeTests
              ? `${entries.length} shown, tests included`
              : `${realCount} recorded`
          }
          action={
            entries.length > 0 ? (
              <form action={clearActivityAction}>
                <Button type="submit" variant="ghost" size="sm">
                  Clear history
                </Button>
              </form>
            ) : undefined
          }
        />
        <ActivityList
          entries={entries}
          emptyTitle={includeTests ? 'Nothing recorded yet' : 'No real events yet'}
          emptyDescription={
            twitchConnected
              ? 'Follows, subs, raids and cheers will appear here the moment they happen.'
              : 'Connect Twitch to start recording activity.'
          }
        />
      </Panel>
    </>
  )
}
