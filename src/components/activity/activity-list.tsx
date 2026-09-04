import { EmptyState } from '@/components/ui/panel'
import type { ActivityEntry } from '@/lib/services/event-service'

/** Relative time, because "3 minutes ago" is what you want mid-stream. */
function ago(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86_400)}d ago`
}

function detail(entry: ActivityEntry): string | null {
  const data = entry.data

  if (typeof data.viewers === 'number') return `${data.viewers.toLocaleString()} viewers`
  if (typeof data.bits === 'number') return `${data.bits.toLocaleString()} bits`
  if (typeof data.total === 'number') return `${data.total} subs`
  if (typeof data.tier === 'string') {
    return data.tier === '1000' ? 'Tier 1' : data.tier === '2000' ? 'Tier 2' : 'Tier 3'
  }
  return null
}

export function ActivityList({
  entries,
  emptyTitle = 'No events yet',
  emptyDescription = 'Follows, subs, raids and cheers appear here as they happen.',
}: {
  entries: ActivityEntry[]
  emptyTitle?: string
  emptyDescription?: string
}) {
  if (entries.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <ul>
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-b-0"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="w-28 shrink-0 text-xs font-medium tracking-wide text-ink-subtle uppercase">
              {entry.label}
            </span>
            <span className="truncate text-sm text-ink">{entry.actorName}</span>
            {detail(entry) ? (
              <span className="text-sm text-ink-subtle">{detail(entry)}</span>
            ) : null}
            {entry.isTest ? (
              <span className="rounded-full bg-line px-2 py-0.5 text-[0.6875rem] text-ink-subtle">
                test
              </span>
            ) : null}
          </div>

          <time dateTime={entry.occurredAt} className="text-xs text-ink-subtle">
            {ago(entry.occurredAt)}
          </time>
        </li>
      ))}
    </ul>
  )
}
