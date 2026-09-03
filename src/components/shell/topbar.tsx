import Link from 'next/link'

import { MobileNav } from '@/components/shell/mobile-nav'
import { Icon } from '@/components/ui/icon'

/**
 * The top bar of the application shell.
 *
 * There is no account menu because there is no account — this runs on one
 * machine for one person. What sits here instead is the thing that actually
 * matters during a stream: whether the app is connected to a platform.
 */
export function Topbar({
  brandName,
  connection,
}: {
  brandName: string | null
  connection: { name: string; isLive: boolean } | null
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        {brandName ? (
          <span className="font-display text-sm font-medium text-ink">{brandName}</span>
        ) : null}
      </div>

      {connection ? (
        <div className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className={
              connection.isLive
                ? 'size-2 rounded-full bg-live shadow-[0_0_0_3px] shadow-live/20'
                : 'size-2 rounded-full bg-line-strong'
            }
          />
          <span className="text-ink-muted">
            {connection.name} · {connection.isLive ? 'Live' : 'Offline'}
          </span>
        </div>
      ) : (
        <Link
          href="/integrations/twitch"
          className="flex items-center gap-2 text-sm text-ink-subtle hover:text-ink"
        >
          <Icon name="integrations" className="size-4" />
          <span>Connect a platform</span>
        </Link>
      )}
    </header>
  )
}
