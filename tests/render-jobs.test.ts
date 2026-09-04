import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, before, describe } from 'node:test'

import { toVisualIdentity } from '../src/lib/hyperframes/identity.ts'
import { findTemplate } from '../src/lib/hyperframes/templates/index.ts'
import { defaultBrandDna } from '../src/lib/schemas/brand.ts'

/**
 * The render pipeline's bookkeeping, without running a renderer.
 *
 * Everything here is the part that has to be right *before* a CLI is involved:
 * the project that gets written to disk, and the states a job moves through.
 * Actually rendering is exercised by driving the real UI, because that is the
 * only place the outcome is a video file.
 */

const workspace = mkdtempSync(path.join(tmpdir(), 'we-renders-'))
process.env.WILLELEMENTS_DATA_DIR = workspace

type ProjectModule = typeof import('../src/lib/hyperframes/project.ts')
type RenderModule = typeof import('../src/lib/services/render-service.ts')
type DbModule = typeof import('../src/lib/db/index.ts')
type SchemaModule = typeof import('../src/lib/db/schema.ts')

let projects: ProjectModule
let renders: RenderModule
let db: DbModule
let schema: SchemaModule

const identity = toVisualIdentity(defaultBrandDna())

before(async () => {
  projects = await import('../src/lib/hyperframes/project.ts')
  renders = await import('../src/lib/services/render-service.ts')
  db = await import('../src/lib/db/index.ts')
  schema = await import('../src/lib/db/schema.ts')
})

after(() => {
  rmSync(workspace, { recursive: true, force: true })
})

/**
 * Inserts a job row directly.
 *
 * Deliberately not `createRenderJob`, which queues the work as well — this file
 * is about the states, and a test that launched a renderer would take minutes
 * and depend on FFmpeg being installed.
 */
function insertJob(values: { id: string; status: string; projectDir: string }) {
  db.getDb()
    .insert(schema.renderJobs)
    .values({
      id: values.id,
      templateId: 'logo-sting',
      name: 'Test render',
      status: values.status,
      quality: 'draft',
      format: 'mp4',
      width: 1920,
      height: 1080,
      durationMs: 3000,
      input: { headline: 'Test', subhead: '' },
      projectDir: values.projectDir,
    })
    .run()
}

describe('writing a project', () => {
  test('produces a directory the CLI can render', async () => {
    const template = findTemplate('logo-sting')
    assert.ok(template)

    const dir = path.join(workspace, 'projects', 'sting')
    const written = await projects.writeProject(dir, {
      template,
      identity,
      brandName: 'NightShift Gaming',
      input: template.defaults('NightShift Gaming'),
      logoPath: null,
      durationSeconds: template.duration(identity),
    })

    assert.equal(written.indexPath, path.join(dir, 'index.html'))
    assert.equal(written.logoSrc, null)

    const html = await readFile(written.indexPath, 'utf8')
    assert.match(html, /data-composition-id="main"/)

    const config = JSON.parse(await readFile(path.join(dir, 'hyperframes.json'), 'utf8'))
    assert.equal(config.paths.assets, 'assets')

    // GSAP has to be beside the composition — a relative script tag is the only
    // thing the renderer will load.
    const gsap = await stat(path.join(dir, 'assets', 'vendor', 'gsap.min.js'))
    assert.ok(gsap.size > 10_000)
  })

  test('copies the logo in and references it relatively', async () => {
    const template = findTemplate('logo-sting')
    assert.ok(template)

    const logoPath = path.join(workspace, 'source-logo.png')
    await writeFile(logoPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))

    const dir = path.join(workspace, 'projects', 'with-logo')
    const written = await projects.writeProject(dir, {
      template,
      identity,
      brandName: 'NightShift Gaming',
      input: template.defaults('NightShift Gaming'),
      logoPath,
      durationSeconds: template.duration(identity),
    })

    assert.equal(written.logoSrc, 'assets/logo.png')

    const html = await readFile(written.indexPath, 'utf8')
    assert.match(html, /src="assets\/logo\.png"/)
    // Never an absolute path: the project has to render on another machine.
    assert.equal(html.includes(workspace), false)

    await stat(path.join(dir, 'assets', 'logo.png'))
  })

  test('replaces whatever was there, so a retry cannot inherit a failed attempt', async () => {
    const template = findTemplate('scene-card')
    assert.ok(template)

    const dir = path.join(workspace, 'projects', 'retry')
    const plan = {
      template,
      identity,
      brandName: 'NightShift Gaming',
      input: template.defaults('NightShift Gaming'),
      logoPath: null,
      durationSeconds: template.duration(identity),
    }

    await projects.writeProject(dir, plan)
    await writeFile(path.join(dir, 'leftover.txt'), 'from the attempt that failed')

    await projects.writeProject(dir, plan)

    await assert.rejects(() => stat(path.join(dir, 'leftover.txt')))
  })
})

describe('render job states', () => {
  test('an unknown composition is refused rather than queued', () => {
    assert.throws(
      () => renders.createRenderJob({ templateId: 'nope', quality: 'draft', headline: '', subhead: '' }),
      /no composition called/i,
    )
  })

  test('summaries carry what the UI needs and nothing about this machine', () => {
    insertJob({ id: 'job-summary', status: 'completed', projectDir: 'renders/job-summary' })

    const job = renders.getRenderJob('job-summary')
    assert.ok(job)

    const summary = renders.summarizeRenderJob(job)

    assert.equal(summary.id, 'job-summary')
    assert.equal(summary.status, 'completed')
    assert.equal(Object.hasOwn(summary, 'projectDir'), false)
  })

  test('the stored input round-trips through the JSON column', () => {
    insertJob({ id: 'job-input', status: 'queued', projectDir: 'renders/job-input' })

    assert.deepEqual(renders.getRenderJob('job-input')?.input, {
      headline: 'Test',
      subhead: '',
    })
  })

  test('cancelling a queued job marks it, and a finished one is left alone', () => {
    insertJob({ id: 'job-cancel', status: 'queued', projectDir: 'renders/job-cancel' })
    insertJob({ id: 'job-done', status: 'completed', projectDir: 'renders/job-done' })

    assert.equal(renders.cancelRenderJob('job-cancel'), true)
    assert.equal(renders.getRenderJob('job-cancel')?.status, 'cancelled')
    assert.ok(renders.getRenderJob('job-cancel')?.completedAt)

    assert.equal(renders.cancelRenderJob('job-done'), false)
    assert.equal(renders.getRenderJob('job-done')?.status, 'completed')
  })

  test('hasActiveRenders only counts work that can still finish', () => {
    db.getDb().delete(schema.renderJobs).run()
    assert.equal(renders.hasActiveRenders(), false)

    insertJob({ id: 'job-active', status: 'processing', projectDir: 'renders/job-active' })
    assert.equal(renders.hasActiveRenders(), true)

    db.getDb().delete(schema.renderJobs).run()
  })

  test('a restart closes out anything that was in flight', () => {
    insertJob({ id: 'job-queued', status: 'queued', projectDir: 'renders/job-queued' })
    insertJob({ id: 'job-running', status: 'processing', projectDir: 'renders/job-running' })
    insertJob({ id: 'job-kept', status: 'completed', projectDir: 'renders/job-kept' })

    assert.equal(renders.recoverInterruptedRenders(), 2)

    // A progress bar that can never move is worse than an honest failure.
    for (const id of ['job-queued', 'job-running']) {
      const job = renders.getRenderJob(id)
      assert.equal(job?.status, 'failed')
      assert.match(job?.error ?? '', /restarted/i)
    }

    assert.equal(renders.getRenderJob('job-kept')?.status, 'completed')
    assert.equal(renders.recoverInterruptedRenders(), 0)
  })

  test('deleting a job removes its row and its project directory', async () => {
    const template = findTemplate('logo-sting')
    assert.ok(template)

    const id = 'job-delete'
    const dir = path.join(workspace, 'renders', id)
    await projects.writeProject(dir, {
      template,
      identity,
      brandName: 'NightShift Gaming',
      input: template.defaults('NightShift Gaming'),
      logoPath: null,
      durationSeconds: template.duration(identity),
    })

    insertJob({ id, status: 'completed', projectDir: path.join('renders', id) })

    await renders.deleteRenderJob(id)

    assert.equal(renders.getRenderJob(id), null)
    await assert.rejects(() => stat(dir))
  })
})
