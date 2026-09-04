import Link from 'next/link'
import type { Metadata } from 'next'

import { toggleAlert } from '@/app/(app)/stream/alerts/actions'
import { PageHeader } from '@/components/shell/page-header'
import { Button, ButtonLink } from '@/components/ui/button'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { EVENT_LABELS } from '@/lib/schemas/event'
import { listAlertConfigs } from '@/lib/services/alert-service'
import { listOverlays } from '@/lib/services/overlay-service'

export const metadata: Metadata = { title: 'Alerts' }

export default function AlertsPage() {
  const configs = listAlertConfigs()
  const overlays = listOverlays()

  return (
    <>
      <PageHeader
        title="Alerts"
        description="What plays in your overlay when something happens on stream."
        action={
          overlays.length > 0 ? (
            <ButtonLink href={`/stream/overlays/${overlays[0].id}`} variant="secondary" size="sm">
              Test in overlay
            </ButtonLink>
          ) : (
            <ButtonLink href="/stream/overlays" variant="secondary" size="sm">
              Create an overlay
            </ButtonLink>
          )
        }
      />

      <Panel>
        <PanelHeader title="Event alerts" description="Each one is styled from your Brand DNA" />
        <ul>
          {configs.map((config) => (
            <li
              key={config.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0">
                <Link
                  href={`/stream/alerts/${encodeURIComponent(config.eventType)}`}
                  className="font-display text-sm font-medium text-ink hover:underline"
                >
                  {EVENT_LABELS[config.eventType as keyof typeof EVENT_LABELS] ??
                    config.eventType}
                </Link>
                <p className="truncate text-xs text-ink-subtle">
                  {config.messageTemplate} · {(config.durationMs / 1000).toFixed(1)}s
                  {config.soundAssetId ? ' · sound' : ''}
                  {config.minThreshold ? ` · min ${config.minThreshold}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={
                    config.enabled
                      ? 'rounded-full bg-positive/15 px-2.5 py-1 text-xs font-medium text-positive'
                      : 'rounded-full bg-line px-2.5 py-1 text-xs text-ink-subtle'
                  }
                >
                  {config.enabled ? 'On' : 'Off'}
                </span>

                <form action={toggleAlert}>
                  <input type="hidden" name="eventType" value={config.eventType} />
                  <Button type="submit" variant="ghost" size="sm">
                    {config.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title="How alerts work" />
        <ul className="space-y-2.5 px-5 py-5 text-sm text-ink-muted">
          <li>
            Alerts render live in the browser source — nothing is pre-rendered to video, so
            a change here applies the next time the overlay loads.
          </li>
          <li>
            They queue. Several events at once play one after another rather than stacking.
          </li>
          <li>
            A disabled alert, or one below its minimum threshold, never enters the queue at
            all — so it cannot delay a real one.
          </li>
        </ul>
      </Panel>
    </>
  )
}
