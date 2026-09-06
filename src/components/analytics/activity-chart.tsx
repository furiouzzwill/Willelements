import type { DailyPoint } from '@/lib/services/analytics-service'

/**
 * Events per day.
 *
 * One series, so there is no legend — the panel title names what the bars are,
 * and a legend box for a single colour is noise. Every day in the window gets a
 * column including the empty ones, which is the whole point: a quiet fortnight
 * should look quiet rather than being compressed out of existence.
 *
 * Drawn as inline SVG rather than with a charting library. The project vendors
 * GSAP rather than fetching it and ships no chart dependency; a bar chart is a
 * few rectangles and does not justify one.
 */

const HEIGHT = 140
const GAP = 2
const RADIUS = 4

export function ActivityChart({ points, label }: { points: DailyPoint[]; label: string }) {
  if (points.length === 0) return null

  const max = Math.max(...points.map((point) => point.count), 1)
  const width = 720
  const slot = width / points.length
  const barWidth = Math.max(slot - GAP, 1)

  // Label the busiest day and the ends. A number on every column is unreadable
  // at 30 columns and hides the shape the chart exists to show.
  const busiest = points.reduce(
    (best, point, index) => (point.count > points[best].count ? index : best),
    0,
  )

  // The peak label is dropped when it would sit on top of an end label. Three
  // slots is about the width of "Sep 6" at this size, and two overlapping dates
  // read as one corrupt string rather than as two labels.
  const last = points.length - 1
  const peakFits = busiest >= 3 && busiest <= last - 3 && points[busiest].count > 0
  const labelled = new Map<number, 'start' | 'middle' | 'end'>([
    [0, 'start'],
    [last, 'end'],
  ])
  if (peakFits) labelled.set(busiest, 'middle')

  return (
    <figure className="px-5 py-4">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${HEIGHT + 24}`}
          className="h-auto w-full min-w-[480px]"
          role="img"
          aria-label={`${label}. Peak ${points[busiest].count} on ${formatDay(points[busiest].date)}.`}
        >
          {/* Recessive baseline — present for reference, never competing with the data. */}
          <line
            x1={0}
            y1={HEIGHT}
            x2={width}
            y2={HEIGHT}
            stroke="var(--color-line)"
            strokeWidth={1}
          />

          {points.map((point, index) => {
            const barHeight = point.count === 0 ? 0 : Math.max((point.count / max) * HEIGHT, 3)
            const x = index * slot + GAP / 2
            const y = HEIGHT - barHeight

            return (
              <g key={point.date}>
                {barHeight > 0 ? (
                  <path
                    d={roundedTop(x, y, barWidth, barHeight, RADIUS)}
                    fill="var(--color-accent)"
                  />
                ) : (
                  // A visible trace for an empty day, so the axis does not look broken.
                  <rect
                    x={x}
                    y={HEIGHT - 1}
                    width={barWidth}
                    height={1}
                    fill="var(--color-line)"
                  />
                )}
                <title>
                  {formatDay(point.date)}: {point.count} {point.count === 1 ? 'event' : 'events'}
                </title>
              </g>
            )
          })}

          {points.map((point, index) => {
            const anchor = labelled.get(index)
            if (!anchor) return null

            // The end labels hug the plot edges rather than centring on their
            // column, which would push half the text outside the viewBox.
            const x =
              anchor === 'start' ? 0 : anchor === 'end' ? width : index * slot + slot / 2

            return (
              <text
                key={`label-${point.date}`}
                x={x}
                y={HEIGHT + 16}
                textAnchor={anchor}
                className="text-[10px]"
                fill="var(--color-ink-subtle)"
              >
                {formatDay(point.date)}
              </text>
            )
          })}
        </svg>
      </div>

      {/* The same numbers as text, for anyone not reading the picture. */}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Events</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{point.date}</th>
              <td>{point.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <figcaption className="mt-2 text-xs text-ink-subtle">
        Peak {points[busiest].count} on {formatDay(points[busiest].date)} · {points.length} days
      </figcaption>
    </figure>
  )
}

/** A bar with rounded top corners, square where it meets the baseline. */
function roundedTop(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height)
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height}`,
    'Z',
  ].join(' ')
}

function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
