import type { Metadata } from 'next'

import { LiveStatus } from '@/app/(app)/dashboard/live-status'
import { ActivityList } from '@/components/activity/activity-list'
import { PageHeader } from '@/components/shell/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { ButtonLink } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { CURRENT_PHASE, navigation } from '@/config/navigation'
import { getDefaultBrand } from '@/lib/services/brand-service'
import { getSetupState } from '@/lib/services/setup-service'
import { getChannelState } from '@/lib/services/twitch-service'
import { listActivity } from '@/lib/services/event-service'

export const metadata: Metadata = { title: 'Dashboard' }

function greeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function SetupRow({ done, label, phase }: { done: boolean; label: string; phase: number }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-b-0">
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={
            done
              ? 'grid size-4 place-items-center rounded-full bg-positive/20 text-positive'
              : 'size-4 rounded-full border border-line-strong'
          }
        >
          {done ? '✓' : null}
        </span>
        <span className={done ? 'text-sm text-ink' : 'text-sm text-ink-muted'}>{label}</span>
      </span>
      <span className="text-xs text-ink-subtle">
        {done ? 'Done' : `Phase ${phase}`}
      </span>
    </li>
  )
}

/**
 * The command center.
 *
 * Panels stay empty until the phase that supplies their data ships. Live status
 * and audience come from a connected platform (Phase 4 and 7) — the rule is
 * that we never show a number no provider actually gave us.
 */
export default async function DashboardPage() {
  const brand = getDefaultBrand()
  const setup = getSetupState()
  const channel = await getChannelState()
  const activity = listActivity({ limit: 6 })

  // The next destinations to unlock, whichever phases they fall in. Labels are
  // deduplicated because some names appear under more than one section — a list
  // showing "Twitch" twice reads as a bug.
  const upcoming = [
    ...new Map(
      navigation
        .flatMap((section) => section.items)
        .filter((item) => item.phase > CURRENT_PHASE)
        .sort((a, b) => a.phase - b.phase)
        .map((item) => [item.label, item]),
    ).values(),
  ].slice(0, 4)

  return (
    <>
      <PageHeader
        title={`${greeting(new Date())}${brand ? `, ${brand.name}` : ''}`}
        description={
          setup.hasNamedBrand
            ? 'Connect a platform to start seeing live data.'
            : 'Everything runs on this machine. Start by setting up your brand.'
        }
      />

      <Panel>
        <PanelHeader title="Setup" description="What's ready and what's next" />
        <ul>
          <SetupRow done={setup.databaseReady} label="Local database created" phase={2} />
          <SetupRow done={setup.hasNamedBrand} label="Brand set up" phase={3} />
          <SetupRow done={setup.hasLogo} label="Logo uploaded" phase={3} />
          <SetupRow done={setup.hasConnectedAccount} label="Twitch connected" phase={4} />
          <SetupRow done={setup.hasOverlay} label="Overlay created" phase={5} />
          <SetupRow done={setup.hasAlertConfig} label="Follower alert configured" phase={6} />
        </ul>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <LiveStatus state={channel} />

        <Panel>
          <PanelHeader
            title="Recent activity"
            description="Follows, subs, raids and cheers"
            action={
              activity.length > 0 ? (
                <ButtonLink href="/activity" variant="ghost" size="sm">
                  View all
                </ButtonLink>
              ) : undefined
            }
          />
          <ActivityList
            entries={activity}
            emptyTitle="No events yet"
            emptyDescription={
              setup.hasConnectedAccount
                ? 'Events appear the moment they happen on your channel.'
                : 'Connect Twitch and real events will land here.'
            }
          />
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="What's next"
          description={`Phase ${CURRENT_PHASE} is done — build your overlay layout`}
        />
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-ink-muted">
            Overlays, alerts and live Twitch events all work. Place widgets on your
            overlay with the editor, then connect Twitch and everything starts filling
            with real data.
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
            View storage settings
          </ButtonLink>
        </div>
      </Panel>
    </>
  )
}
