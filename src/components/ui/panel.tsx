import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('panel', className)} {...props} />
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="space-y-1">
        <h2 className="font-display text-sm font-semibold tracking-wide text-ink uppercase">
          {title}
        </h2>
        {description ? <p className="text-sm text-ink-subtle">{description}</p> : null}
      </div>
      {action}
    </header>
  )
}

/**
 * Placeholder for data we cannot show yet — either because the phase has not
 * shipped or because no provider is connected. Being explicit here is a product
 * rule, not just a UI nicety: the dashboard must never invent metrics.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
      <p className="font-display text-base font-medium text-ink">{title}</p>
      <p className="max-w-sm text-sm text-ink-subtle">{description}</p>
      {action}
    </div>
  )
}
