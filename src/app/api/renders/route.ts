import { NextResponse } from 'next/server'

import { listRenderJobs, summarizeRenderJob } from '@/lib/services/render-service'

/**
 * The render queue, as JSON, for the animations page to poll.
 *
 * Polling rather than the event stream that drives overlays, and deliberately:
 * a render reports progress for a minute or two and then stops forever, whereas
 * the overlay stream is a permanent connection carrying live events to OBS.
 * Hanging render progress off it would keep a connection open for a page nobody
 * is looking at, to deliver an update that a two-second poll delivers just as
 * well. The client stops polling the moment nothing is running.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    { jobs: listRenderJobs().map(summarizeRenderJob) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
