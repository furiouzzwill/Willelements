import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * A single headline number.
 *
 * A number on its own is not a chart and should not be drawn as one — a bar of
 * length one compares against nothing. The tile carries the figure, what it
 * counts, and the window it covers, so the number is never left to be guessed
 * at from a page title.
 *
 * `value` is deliberately `number | null`. Null renders an em dash rather than
 * a zero, because "no provider gave us this" and "this is zero" are different
 * facts and the project treats conflating them as a bug.
 */
export function StatTile({
  label,
  value,
  hint,
  format = 'count',
}: {
  label: string
  value: number | null
  hint?: string
  format?: 'count' | 'duration'
}) {
  const display =
    value === null ? '—' : format === 'duration' ? formatDuration(value) : value.toLocaleString()

  return (
    <div className="rounded-lg border border-line bg-surface-raised px-4 py-3">
      <p className="font-display text-xs font-medium tracking-wide text-ink-subtle uppercase">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-display text-2xl font-semibold tabular-nums',
          value === null ? 'text-ink-subtle' : 'text-ink',
        )}
      >
        {display}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
}

/** Milliseconds as `12h 30m`, or `45m` under an hour. Never a bare millisecond count. */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}
