import type { Metadata } from 'next'

import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { ButtonLink } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { CURRENT_PHASE, navigation } from '@/config/navigation'
import { getDefaultBrand } from '@/lib/services/brand-service'
import { getSetupState } from '@/lib/services/setup-service'

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
export default function DashboardPage() {
  const brand = getDefaultBrand()
  const setup = getSetupState()

  // The next destinations to unlock, whichever phases they happen to fall in.
  const upcoming = navigation
    .flatMap((section) => section.items)
    .filter((item) => item.phase > CURRENT_PHASE)
    .sort((a, b) => a.phase - b.phase)
    .slice(0, 4)

  return (
    <>
      <PageHeader
        title={`${greeting(new Date())}${brand ? `, ${brand.name}` : ''}`}
        description={
          setup.hasBrand
            ? 'Connect a platform to start seeing live data.'
            : 'Everything runs on this machine. Start by setting up your brand.'
        }
      />

      <Panel>
        <PanelHeader title="Setup" description="What's ready and what's next" />
        <ul>
          <SetupRow done={setup.databaseReady} label="Local database created" phase={2} />
          <SetupRow done={setup.hasBrand} label="Brand DNA saved" phase={3} />
          <SetupRow done={setup.hasConnectedAccount} label="Twitch connected" phase={4} />
          <SetupRow done={setup.hasOverlay} label="Overlay created" phase={5} />
          <SetupRow done={setup.hasAlertConfig} label="Follower alert configured" phase={6} />
        </ul>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Live status" description="Your connected platform" />
          <EmptyState
            title="No platform connected"
            description="Twitch connection arrives in Phase 4. Until then there is no live status to report — and we will not guess one."
          />
        </Panel>

        <Panel>
          <PanelHeader title="Recent activity" description="Follows, subs, raids, cheers" />
          <EmptyState
            title="No events yet"
            description="Events land here once Twitch is connected and streaming to this machine."
          />
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="What's next"
          description={`Phase ${CURRENT_PHASE} is done — local storage is working`}
        />
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-ink-muted">
            The app, its database and its files all live in this project folder. Nothing
            is sent anywhere, and nothing costs money to run.
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
