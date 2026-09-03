'use client'

import { useState } from 'react'

import { Sidebar } from '@/components/shell/sidebar'
import { Icon } from '@/components/ui/icon'

/** Sidebar in a drawer for narrow viewports. */
export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="rounded-lg p-2 text-ink-muted hover:bg-surface-raised hover:text-ink lg:hidden"
      >
        <Icon name="chevron" className="size-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  )
}
