import Link from 'next/link'

import { WINDOWS, WINDOW_LABELS, type Window } from '@/lib/services/analytics-service'
import { cn } from '@/lib/utils'

/**
 * The time range, as links rather than a client-side control.
 *
 * The window lives in the URL, so a range survives a refresh and can be
 * bookmarked or shared. Everything on these pages is server-rendered from
 * SQLite; adding client state to change a number that the server already knows
 * how to compute would be work for its own sake.
 */
export function WindowTabs({ current, basePath }: { current: Window; basePath: string }) {
  return (
    <nav aria-label="Time range" className="flex gap-1">
      {WINDOWS.map((window) => {
        const active = window === current

        return (
          <Link
            key={window}
            href={window === '30d' ? basePath : `${basePath}?window=${window}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-accent-soft text-ink'
                : 'text-ink-subtle hover:bg-surface-raised hover:text-ink',
            )}
          >
            {WINDOW_LABELS[window]}
          </Link>
        )
      })}
    </nav>
  )
}
