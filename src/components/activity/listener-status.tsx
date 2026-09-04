import Link from 'next/link'

import { EVENT_LABELS, type EventType } from '@/lib/schemas/event'
import { SCOPE_PURPOSE } from '@/lib/providers/twitch/subscriptions'
import type { ListenerStatus } from '@/lib/providers/twitch/eventsub'

const STATE_COPY: Record<ListenerStatus['state'], { label: string; tone: string }> = {
  stopped: { label: 'Not listening', tone: 'bg-line-strong' },
  connecting: { label: 'Connecting', tone: 'bg-warning' },
  connected: { label: 'Listening for events', tone: 'bg-positive' },
  reconnecting: { label: 'Reconnecting', tone: 'bg-warning' },
  error: { label: 'Problem', tone: 'bg-live' },
}

/**
 * Whether the app is actually receiving events from Twitch.
 *
 * Worth its own panel: a dead EventSub connection looks exactly like a quiet
 * stream, and the first sign of trouble should not be a viewer asking why the
 * alerts stopped.
 */
export function ListenerStatusPanel({ status }: { status: ListenerStatus }) {
  const copy = STATE_COPY[status.state]

  return (
    <div className="space-y-4 px-5 py-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span aria-hidden="true" className={`size-2.5 rounded-full ${copy.tone}`} />
        <span className="font-display text-sm font-medium text-ink">{copy.label}</span>
        {status.state === 'reconnecting' && status.attempts > 0 ? (
          <span className="text-sm text-ink-subtle">attempt {status.attempts}</span>
        ) : null}
      </div>

      {status.lastError ? (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
          {status.lastError}
        </p>
      ) : null}

      {status.subscribed.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-sm text-ink-muted">Receiving:</p>
          <div className="flex flex-wrap gap-1.5">
            {status.subscribed.map((type) => (
              <span
                key={type}
                className="rounded-full border border-line bg-surface-raised px-2.5 py-1 text-xs text-ink"
              >
                {EVENT_LABELS[type as EventType] ?? type}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {status.unavailable.length > 0 ? (
        <div className="space-y-1.5 border-t border-line pt-4">
          <p className="text-sm text-ink-muted">
            These need permissions you have not granted yet:
          </p>
          <ul className="space-y-1">
            {status.unavailable.map((item) => (
              <li key={item.eventType} className="text-sm text-ink-subtle">
                <span className="text-ink">
                  {EVENT_LABELS[item.eventType as EventType] ?? item.eventType}
                </span>{' '}
                — {SCOPE_PURPOSE[item.scope] ?? item.scope}
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-subtle">
            <Link
              href="/api/twitch/connect"
              prefetch={false}
              className="font-medium text-accent hover:underline"
            >
              Reconnect Twitch
            </Link>{' '}
            to grant them.
          </p>
        </div>
      ) : null}

      {status.lastEventAt ? (
        <p className="text-xs text-ink-subtle">
          Last event {new Date(status.lastEventAt).toLocaleTimeString()}
        </p>
      ) : null}
    </div>
  )
}
