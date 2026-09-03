import { MobileNav } from '@/components/shell/mobile-nav'
import { Icon } from '@/components/ui/icon'

/**
 * The top bar of the application shell.
 *
 * There is no account menu because there is no account — this runs on one
 * machine for one person. What sits here instead is the thing that actually
 * matters during a stream: whether the app is connected to a platform.
 */
export function Topbar({ brandName }: { brandName: string | null }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        {brandName ? (
          <span className="font-display text-sm font-medium text-ink">{brandName}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-sm text-ink-subtle">
        <Icon name="integrations" className="size-4" />
        <span>No platform connected</span>
      </div>
    </header>
  )
}
