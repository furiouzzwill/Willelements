'use client'

import { useEffect, useState } from 'react'

import { cancelRender, removeRender } from '@/app/(app)/create/animations/actions'
import { Button } from '@/components/ui/button'
import { Checkerboard } from '@/components/ui/checkerboard'
import { EmptyState } from '@/components/ui/panel'
import { FINISHED_STATUSES, type RenderStatus } from '@/lib/schemas/render'
import type { RenderJobSummary } from '@/lib/services/render-service'

/**
 * The render queue, refreshing itself while anything is running.
 *
 * Polling stops as soon as every job has reached a terminal state, so a page
 * left open on a finished queue costs nothing. Two seconds is chosen against
 * what the renderer actually reports: it emits a handful of progress updates
 * over a render measured in tens of seconds, so a faster poll would return the
 * same numbers.
 */

const POLL_MS = 2000

const STATUS_STYLES: Record<RenderStatus, string> = {
  queued: 'bg-line text-ink-subtle',
  processing: 'bg-accent/15 text-accent',
  completed: 'bg-positive/15 text-positive',
  failed: 'bg-live/15 text-live',
  cancelled: 'bg-line text-ink-subtle',
}

const STATUS_LABELS: Record<RenderStatus, string> = {
  queued: 'Queued',
  processing: 'Rendering',
  completed: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

function isActive(jobs: RenderJobSummary[]): boolean {
  return jobs.some((job) => !FINISHED_STATUSES.includes(job.status))
}

export function RenderQueue({ initialJobs }: { initialJobs: RenderJobSummary[] }) {
  const [jobs, setJobs] = useState(initialJobs)

  // The server's list wins whenever the page re-renders — a completed render
  // revalidates the page, and the newer list is the one to show.
  const [seed, setSeed] = useState(initialJobs)
  if (seed !== initialJobs) {
    setSeed(initialJobs)
    setJobs(initialJobs)
  }

  const active = isActive(jobs)

  useEffect(() => {
    if (!active) return

    let cancelled = false

    const tick = async () => {
      try {
        const response = await fetch('/api/renders', { cache: 'no-store' })
        if (!response.ok) return
        const payload = (await response.json()) as { jobs: RenderJobSummary[] }
        if (!cancelled) setJobs(payload.jobs)
      } catch {
        // A poll that fails is not worth reporting: the next one is 2s away,
        // and the only way this fails locally is the server restarting.
      }
    }

    const timer = setInterval(tick, POLL_MS)
    void tick()

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [active])

  if (jobs.length === 0) {
    return (
      <EmptyState
        title="Nothing rendered yet"
        description="Pick a composition above and render it. It runs in the background — you can keep working."
      />
    )
  }

  return (
    <ul>
      {jobs.map((job) => (
        <li key={job.id} className="border-b border-line px-5 py-4 last:border-b-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display truncate text-sm font-medium text-ink">{job.name}</p>
              <p className="text-xs text-ink-subtle">
                {job.format.toUpperCase()} · {job.quality} ·{' '}
                {(job.durationMs / 1000).toFixed(2).replace(/\.?0+$/, '')}s
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[job.status]}`}
              >
                {STATUS_LABELS[job.status]}
              </span>

              {job.status === 'queued' || job.status === 'processing' ? (
                <form action={cancelRender}>
                  <input type="hidden" name="id" value={job.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Stop
                  </Button>
                </form>
              ) : (
                <form action={removeRender}>
                  <input type="hidden" name="id" value={job.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Remove
                  </Button>
                </form>
              )}
            </div>
          </div>

          {job.status === 'processing' ? (
            <div className="mt-3 space-y-1.5">
              <div
                role="progressbar"
                aria-valuenow={job.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${job.name} render progress`}
                className="h-1.5 w-full overflow-hidden rounded-full bg-line"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500"
                  style={{ width: `${Math.max(3, job.progress)}%` }}
                />
              </div>
              <p className="text-xs text-ink-subtle">
                {job.progress}% · {job.stage ?? 'Working'}
              </p>
            </div>
          ) : null}

          {job.status === 'failed' && job.error ? (
            <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-canvas px-3 py-2 text-xs whitespace-pre-wrap text-ink-subtle">
              {job.error}
            </pre>
          ) : null}

          {job.status === 'completed' && job.outputAssetId ? (
            <div className="mt-3 space-y-2">
              {/* Checkerboard behind it, because a transparent WebM against a
                  solid panel looks identical to an opaque one. */}
              <Checkerboard className="overflow-hidden rounded-lg border border-line">
                <video
                  src={`/api/assets/${job.outputAssetId}`}
                  controls
                  loop
                  muted
                  playsInline
                  className="block max-h-72 w-full bg-transparent object-contain"
                />
              </Checkerboard>
              <a
                href={`/api/assets/${job.outputAssetId}`}
                download
                className="text-xs text-accent hover:underline"
              >
                Download for OBS
              </a>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
