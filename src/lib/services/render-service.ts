import 'server-only'

import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { desc, eq, inArray } from 'drizzle-orm'

import { RENDERS_DIR, getDb } from '@/lib/db'
import { renderJobs, type RenderJob } from '@/lib/db/schema'
import { readJson } from '@/lib/db/json'
import { toVisualIdentity } from '@/lib/hyperframes/identity'
import { writeProject } from '@/lib/hyperframes/project'
import { findTemplate, type CompositionTemplate } from '@/lib/hyperframes/templates'
import { probeToolchain } from '@/lib/hyperframes/toolchain'
import {
  compositionInput,
  renderRequest,
  type CompositionInputValues,
  type RenderQuality,
  type RenderRequest,
  type RenderStatus,
} from '@/lib/schemas/render'
import { assetPath, getAsset, saveGeneratedAsset } from '@/lib/services/asset-service'
import { getBrand, getDefaultBrand } from '@/lib/services/brand-service'

/**
 * Rendering compositions to video.
 *
 * The shape of this service is decided by one fact: a render takes tens of
 * seconds to minutes and pins the CPU. So it never happens inside a request.
 * Creating a job writes a row and returns immediately; a background worker
 * picks it up, and the UI watches the row.
 *
 * **One render at a time, deliberately.** This is the same machine that is
 * encoding a live stream. Two renders would double the CPU cost of a feature
 * whose whole purpose is to be used while other things are happening, and the
 * CLI already parallelises frame capture across workers internally, so a second
 * concurrent job buys nothing.
 *
 * What this service does *not* do is render alerts. Live events play in the
 * browser overlay runtime, per-event, in milliseconds. Putting a live alert
 * through a render job would make it slow, expensive and fragile — the three
 * things a live tool cannot be.
 */

/** A render that has not finished in half an hour has hung. */
const RENDER_TIMEOUT_MS = 30 * 60 * 1000

export class RenderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RenderError'
  }
}

export type RenderJobView = RenderJob & {
  input: CompositionInputValues
  template: CompositionTemplate | null
}

function toView(row: RenderJob): RenderJobView {
  return {
    ...row,
    input: readJson(compositionInput, row.input, 'render_jobs.input'),
    template: findTemplate(row.templateId),
  }
}

/**
 * A job as the browser sees it.
 *
 * Named separately from the row because the row is not safe to widen casually:
 * `project_dir` is a path on this machine, and there is no reason for it to
 * travel to a page. Everything the UI needs is listed here explicitly.
 */
export type RenderJobSummary = {
  id: string
  name: string
  templateId: string
  status: RenderStatus
  progress: number
  stage: string | null
  error: string | null
  format: string
  quality: string
  durationMs: number
  outputAssetId: string | null
  createdAt: string
  completedAt: string | null
}

export function summarizeRenderJob(job: RenderJob): RenderJobSummary {
  return {
    id: job.id,
    name: job.name,
    templateId: job.templateId,
    status: job.status as RenderStatus,
    progress: job.progress,
    stage: job.stage,
    error: job.error,
    format: job.format,
    quality: job.quality,
    durationMs: job.durationMs,
    outputAssetId: job.outputAssetId,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  }
}

export function listRenderJobs(limit = 40): RenderJobView[] {
  return getDb()
    .select()
    .from(renderJobs)
    .orderBy(desc(renderJobs.createdAt))
    .limit(limit)
    .all()
    .map(toView)
}

export function getRenderJob(id: string): RenderJobView | null {
  const row = getDb().select().from(renderJobs).where(eq(renderJobs.id, id)).get()
  return row ? toView(row) : null
}

/** True while any job is queued or running, so the UI knows to keep watching. */
export function hasActiveRenders(): boolean {
  return (
    getDb()
      .select({ id: renderJobs.id })
      .from(renderJobs)
      .where(inArray(renderJobs.status, ['queued', 'processing']))
      .limit(1)
      .get() !== undefined
  )
}

/**
 * The worker, held on `globalThis` so hot reload does not start a second one.
 *
 * `queue` is a promise chain rather than an array: each job appends itself, and
 * awaiting the previous link is the whole of the "one at a time" rule.
 */
const globalForRenders = globalThis as unknown as {
  __willelementsRenders?: { queue: Promise<void>; running: Map<string, ChildProcess> }
}

function worker() {
  globalForRenders.__willelementsRenders ??= { queue: Promise.resolve(), running: new Map() }
  return globalForRenders.__willelementsRenders
}

export function createRenderJob(request: RenderRequest): RenderJobView {
  const parsed = renderRequest.parse(request)
  const template = findTemplate(parsed.templateId)
  if (!template) {
    throw new RenderError(`There is no composition called "${parsed.templateId}".`)
  }

  const brand = getDefaultBrand()
  if (!brand) {
    throw new RenderError('Set up a brand before rendering — the composition is built from it.')
  }

  const identity = toVisualIdentity(brand.dna)
  const defaults = template.defaults(brand.name)
  const input: CompositionInputValues = {
    headline: parsed.headline || defaults.headline,
    subhead: parsed.subhead || defaults.subhead,
  }

  const id = randomUUID()
  const durationSeconds = template.duration(identity)

  const row = getDb()
    .insert(renderJobs)
    .values({
      id,
      brandId: brand.id,
      templateId: template.id,
      name: `${template.name} — ${input.headline}`.slice(0, 120),
      status: 'queued',
      quality: parsed.quality,
      format: template.format,
      width: template.width,
      height: template.height,
      durationMs: Math.round(durationSeconds * 1000),
      input,
      // Relative on purpose: an absolute path would break the moment the data
      // folder moved to another machine.
      projectDir: path.join('renders', id),
      progress: 0,
    })
    .returning()
    .get()

  const runner = worker()
  runner.queue = runner.queue.then(() =>
    runJob(id).catch((error: unknown) => {
      // The chain must survive a failing job, or every later render is dropped.
      console.error(`[render] job ${id} failed unexpectedly:`, error)
    }),
  )

  return toView(row)
}

function patch(id: string, values: Partial<RenderJob>): void {
  getDb().update(renderJobs).set(values).where(eq(renderJobs.id, id)).run()
}

async function runJob(id: string): Promise<void> {
  const job = getRenderJob(id)
  // Cancelled while it waited its turn. Nothing to do, and nothing to report.
  if (!job || job.status !== 'queued') return

  const template = job.template
  if (!template) {
    patch(id, {
      status: 'failed',
      error: `This job refers to a composition that no longer exists ("${job.templateId}").`,
      completedAt: new Date().toISOString(),
    })
    return
  }

  patch(id, { status: 'processing', startedAt: new Date().toISOString(), stage: 'Preparing' })

  try {
    const toolchain = await probeToolchain()
    if (!toolchain.ready) {
      const missing = toolchain.checks.filter((check) => check.required && !check.ok)
      throw new RenderError(
        toolchain.error ??
          `Rendering needs ${missing.map((check) => check.name).join(' and ')}, which this machine does not have.`,
      )
    }

    const brand = job.brandId ? getBrand(job.brandId) : getDefaultBrand()
    if (!brand) {
      throw new RenderError('The brand this render was queued for has been deleted.')
    }

    const logo = brand.logoAssetId ? getAsset(brand.logoAssetId) : null
    const identity = toVisualIdentity(brand.dna)
    const projectDir = path.join(/* turbopackIgnore: true */ RENDERS_DIR, path.basename(job.projectDir))

    await writeProject(projectDir, {
      template,
      identity,
      brandName: brand.name,
      input: job.input,
      logoPath: logo ? assetPath(logo) : null,
      durationSeconds: job.durationMs / 1000,
    })

    const outputName = `out.${template.format}`
    await runCli(id, projectDir, {
      quality: job.quality as RenderQuality,
      format: template.format,
      output: outputName,
      cli: toolchain.cli,
    })

    // Re-read: the job may have been cancelled while the CLI was running, and a
    // cancelled render must not quietly complete.
    if (getRenderJob(id)?.status === 'cancelled') return

    const asset = await saveGeneratedAsset({
      sourcePath: path.join(projectDir, outputName),
      type: 'animation',
      brandId: brand.id,
      provider: 'hyperframes',
      model: template.id,
      prompt: `${template.name}: ${job.input.headline}${job.input.subhead ? ` / ${job.input.subhead}` : ''}`,
      width: template.width,
      height: template.height,
      durationMs: job.durationMs,
    })

    patch(id, {
      status: 'completed',
      progress: 100,
      stage: null,
      outputAssetId: asset.id,
      error: null,
      completedAt: new Date().toISOString(),
    })
  } catch (error) {
    if (getRenderJob(id)?.status === 'cancelled') return

    const message = error instanceof Error ? error.message : String(error)
    patch(id, {
      status: 'failed',
      stage: null,
      error: message.slice(0, 2000),
      completedAt: new Date().toISOString(),
    })
  }
}

/** `  ███░░░  40%  Capturing frame 30/88` — the CLI's own progress line. */
const PROGRESS_LINE = /(\d{1,3})%\s+(.+?)\s*$/

function runCli(
  id: string,
  projectDir: string,
  options: {
    quality: RenderQuality
    format: string
    output: string
    cli: { command: string; prefix: string[] }
  },
): Promise<void> {
  const args = [
    ...options.cli.prefix,
    'render',
    '--quality',
    options.quality,
    '--format',
    options.format,
    '--output',
    options.output,
  ]

  return new Promise((resolve, reject) => {
    const child = spawn(options.cli.command, args, {
      cwd: projectDir,
      // Inherit the environment so a project-local or nvm-managed Node is found.
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    worker().running.set(id, child)

    let lastProgress = -1
    let lastStage = ''
    // Only the tail is worth keeping: a failed render prints megabytes of trace,
    // and the useful part is always at the end.
    const tail: string[] = []

    const consume = (chunk: Buffer) => {
      // The progress bar is redrawn with a carriage return, so split on both.
      for (const line of chunk.toString().split(/[\r\n]+/)) {
        const text = line.trim()
        if (!text) continue

        tail.push(text)
        if (tail.length > 40) tail.shift()

        const match = PROGRESS_LINE.exec(text)
        if (!match) continue

        const progress = Math.max(0, Math.min(100, Number(match[1])))
        const stage = match[2].slice(0, 80)
        if (progress === lastProgress && stage === lastStage) continue

        lastProgress = progress
        lastStage = stage
        patch(id, { progress, stage })
      }
    }

    child.stdout?.on('data', consume)
    child.stderr?.on('data', consume)

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new RenderError(`The render did not finish within ${RENDER_TIMEOUT_MS / 60000} minutes.`))
    }, RENDER_TIMEOUT_MS)

    const finish = () => {
      clearTimeout(timer)
      worker().running.delete(id)
    }

    child.on('error', (error) => {
      finish()
      reject(new RenderError(`Could not start the renderer: ${error.message}`))
    })

    child.on('close', (code, signal) => {
      finish()
      if (code === 0) {
        resolve()
        return
      }
      if (signal) {
        reject(new RenderError(`The render was stopped (${signal}).`))
        return
      }
      reject(new RenderError(`The renderer exited with code ${code}.\n\n${tail.join('\n')}`))
    })
  })
}

/**
 * Stops a render.
 *
 * A queued job is simply marked; a running one has its process killed. The
 * status is written *before* the kill so the runner, which re-reads the row,
 * sees a cancellation rather than reporting the kill as a failure.
 */
export function cancelRenderJob(id: string): boolean {
  const job = getRenderJob(id)
  if (!job || job.status === 'completed' || job.status === 'failed') return false

  patch(id, {
    status: 'cancelled',
    stage: null,
    completedAt: new Date().toISOString(),
  })

  worker().running.get(id)?.kill('SIGTERM')
  return true
}

/** Forgets a job and its project directory. The rendered asset is left alone. */
export async function deleteRenderJob(id: string): Promise<void> {
  const job = getRenderJob(id)
  if (!job) return

  if (job.status === 'queued' || job.status === 'processing') {
    cancelRenderJob(id)
  }

  getDb().delete(renderJobs).where(eq(renderJobs.id, id)).run()
  await rm(path.join(/* turbopackIgnore: true */ RENDERS_DIR, path.basename(job.projectDir)), {
    recursive: true,
    force: true,
  }).catch(() => {
    // The row is what mattered; a leftover folder is a few kilobytes.
  })
}

/**
 * Closes out jobs that were in flight when the process stopped.
 *
 * Their child processes died with the server, so leaving them as "processing"
 * would show a progress bar that can never move — the one thing worse than a
 * failed render is one that appears to still be going.
 */
export function recoverInterruptedRenders(): number {
  const stranded: RenderStatus[] = ['queued', 'processing']
  const rows = getDb()
    .update(renderJobs)
    .set({
      status: 'failed',
      stage: null,
      error: 'The app restarted while this render was in progress. Render it again.',
      completedAt: new Date().toISOString(),
    })
    .where(inArray(renderJobs.status, stranded))
    .returning({ id: renderJobs.id })
    .all()

  if (rows.length > 0) {
    console.log(`[render] closed ${rows.length} render job(s) interrupted by a restart`)
  }

  return rows.length
}
