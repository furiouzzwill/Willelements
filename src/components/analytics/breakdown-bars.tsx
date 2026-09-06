/**
 * Magnitude across a handful of named categories.
 *
 * Horizontal because the labels are words rather than dates — a vertical
 * version would either rotate them or truncate them, and a chart you have to
 * tilt your head to read is a worse table.
 *
 * Every row is direct-labelled with its value. That is the exception to
 * labelling selectively: there are seven rows, not thirty, and the number is
 * the thing being compared.
 */

export type BreakdownRow = {
  key: string
  label: string
  value: number
}

export function BreakdownBars({
  rows,
  unit,
  emptyLabel = 'Nothing recorded in this window.',
}: {
  rows: BreakdownRow[]
  unit?: string
  emptyLabel?: string
}) {
  const max = Math.max(...rows.map((row) => row.value), 1)
  const allZero = rows.every((row) => row.value === 0)

  return (
    <div className="space-y-2 px-5 py-4">
      {allZero ? <p className="pb-1 text-sm text-ink-subtle">{emptyLabel}</p> : null}

      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3">
          <span className="truncate text-sm text-ink-muted">{row.label}</span>

          <span
            className="h-2 overflow-hidden rounded-full bg-line/40"
            role="img"
            aria-label={`${row.label}: ${row.value}${unit ? ` ${unit}` : ''}`}
          >
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${row.value === 0 ? 0 : Math.max((row.value / max) * 100, 2)}%` }}
            />
          </span>

          <span className="text-right text-sm tabular-nums text-ink">
            {row.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}
