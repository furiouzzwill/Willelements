import { MobileNav } from '@/components/shell/mobile-nav'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { signOut } from '@/app/(auth)/actions'

export function Topbar({ email, displayName }: { email: string; displayName: string }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-ink">{displayName}</p>
          <p className="text-xs text-ink-subtle">{email}</p>
        </div>
        <div
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-full bg-accent-soft font-display text-sm font-semibold text-ink"
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
            <Icon name="logout" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </form>
      </div>
    </header>
  )
}
