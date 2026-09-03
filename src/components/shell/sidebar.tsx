'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Icon } from '@/components/ui/icon'
import { Wordmark } from '@/components/ui/icon'
import { CURRENT_PHASE, isAvailable, navigation } from '@/config/navigation'
import { cn } from '@/lib/utils'

/**
 * Primary navigation.
 *
 * Destinations from later phases stay visible but are rendered as disabled
 * items with the phase they land in. Showing the whole map keeps the product's
 * shape legible without pretending unfinished areas work.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
        <Link href="/dashboard" onClick={onNavigate}>
          <Wordmark />
        </Link>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navigation.map((section) => (
          <div key={section.label}>
            <div className="flex items-center gap-2 px-2 pb-2">
              <Icon name={section.icon} className="size-3.5 text-ink-subtle" />
              <span className="text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-subtle uppercase">
                {section.label}
              </span>
            </div>

            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const available = isAvailable(item)
                const active = pathname === item.href

                if (!available) {
                  return (
                    <li key={item.href}>
                      <span
                        className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-1.5 text-sm text-ink-subtle/60"
                        title={`Available in phase ${item.phase}`}
                      >
                        {item.label}
                        <Icon name="lock" className="size-3 opacity-70" />
                      </span>
                    </li>
                  )
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center rounded-lg px-3 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-accent-soft/60 font-medium text-ink'
                          : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="shrink-0 border-t border-line px-5 py-3 text-xs text-ink-subtle">
        Phase {CURRENT_PHASE} · Foundation
      </p>
    </nav>
  )
}
