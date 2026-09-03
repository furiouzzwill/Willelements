import type { Metadata } from 'next'

import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { ButtonLink } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { displayNameFor, requireUser } from '@/lib/auth/dal'
import { CURRENT_PHASE, navigation } from '@/config/navigation'

export const metadata: Metadata = { title: 'Dashboard' }

function greeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * The command center.
 *
 * Every panel here is deliberately empty until the phase that supplies its data
 * ships. Live status, audience and stream history come from connected providers
 * (Phases 4 and 7) — the product rule is that we never display a metric we did
 * not actually receive from a provider.
 */
export default async function DashboardPage() {
  const user = await requireUser()
  const name = displayNameFor(user)

  const upcoming = navigation
    .flatMap((section) => section.items)
    .filter((item) => item.phase === CURRENT_PHASE + 1 || item.phase === CURRENT_PHASE + 2)
    .slice(0, 4)

  return (
    <>
      <PageHeader
        title={`${greeting(new Date())}, ${name}`}
        description="Your workspace is set up. Connect a platform to start seeing live data."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Live status"
            description="Twitch and YouTube connections"
          />
          <EmptyState
            title="No platforms connected"
            description="Twitch connection arrives in Phase 4. Until then there is no live status to report — and we will not guess one."
          />
        </Panel>

        <Panel>
          <PanelHeader title="Audience" description="Across connected platforms" />
          <EmptyState
            title="Nothing to measure yet"
            description="Audience figures come straight from provider APIs once a channel is connected."
          />
        </Panel>

        <Panel>
          <PanelHeader title="Last stream" description="Duration, viewers, growth" />
          <EmptyState
            title="No stream history"
            description="Stream sessions are recorded from provider events starting in Phase 7."
          />
        </Panel>

        <Panel>
          <PanelHeader title="Recent activity" description="Follows, subs, raids, cheers" />
          <EmptyState
            title="No events yet"
            description="The activity feed fills in once real provider events are flowing."
          />
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="What's next"
          description={`You are on Phase ${CURRENT_PHASE} — the application foundation`}
        />
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-ink-muted">
            Accounts, the protected shell and navigation are working. The next phases add
            the data model, then Brand DNA, then the Twitch connection that makes this
            dashboard come alive.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {upcoming.map((item) => (
              <li
                key={item.href}
                className="flex items-center justify-between rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm"
              >
                <span className="text-ink-muted">{item.label}</span>
                <span className="text-xs text-ink-subtle">Phase {item.phase}</span>
              </li>
            ))}
          </ul>
          <ButtonLink href="/settings" variant="secondary" size="sm">
            <Icon name="settings" />
            Review account settings
          </ButtonLink>
        </div>
      </Panel>
    </>
  )
}
