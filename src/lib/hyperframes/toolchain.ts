import 'server-only'

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { HYPERFRAMES_VERSION } from '@/lib/hyperframes/project'

/**
 * Is this machine actually able to render video?
 *
 * HyperFrames is a CLI, not a library, and it needs FFmpeg and a headless
 * Chrome underneath it. None of that ships with the app, and none of it can be
 * assumed — so the app asks, and then says what it found. The alternative is an
 * animations page with a Render button that produces a stack trace, which is
 * exactly the kind of "integration" the project set out not to build.
 *
 * The probe is slow (it launches the CLI), so it is cached for the life of the
 * process and started in the background at boot. Nothing in a page render ever
 * waits on it.
 */

const run = promisify(execFile)

/** Long enough for npx to fetch the CLI on a first run over a slow link. */
const PROBE_TIMEOUT_MS = 180_000

export type ToolchainCheck = {
  name: string
  ok: boolean
  detail: string
  /** False for things like Docker and local TTS that rendering does not need. */
  required: boolean
  hint?: string
}

export type ResolvedCli = {
  command: string
  /** Arguments that must precede the subcommand. */
  prefix: string[]
  source: 'env' | 'project' | 'path' | 'npx'
  description: string
}

export type ToolchainStatus = {
  /** True only when everything rendering depends on is present. */
  ready: boolean
  cli: ResolvedCli
  version: string | null
  checks: ToolchainCheck[]
  /** Set when the CLI could not be run at all. */
  error: string | null
  checkedAt: string
}

/**
 * The checks a render genuinely depends on.
 *
 * `doctor` reports its own overall `ok`, but that flag goes false for optional
 * extras — local transcription, local text-to-speech, a running Docker daemon —
 * none of which this app uses. Gating on it would tell you rendering is broken
 * when it is fine, so the required set is named here instead.
 */
const REQUIRED_CHECKS = new Set(['FFmpeg', 'FFprobe', 'Chrome', 'Node.js', 'Disk'])

/**
 * How to invoke the CLI, most deliberate choice first.
 *
 * A project-local or global install is preferred over `npx` because it is
 * pinned on disk: `npx` is the fallback that makes the feature work without a
 * separate install step, at the cost of needing the network the first time.
 */
export function resolveCli(): ResolvedCli {
  const override = process.env.HYPERFRAMES_CLI?.trim()
  if (override) {
    return {
      command: override,
      prefix: [],
      source: 'env',
      description: `HYPERFRAMES_CLI=${override}`,
    }
  }

  const local = path.join(process.cwd(), 'node_modules', '.bin', 'hyperframes')
  if (existsSync(local)) {
    return {
      command: local,
      prefix: [],
      source: 'project',
      description: 'node_modules/.bin/hyperframes',
    }
  }

  const onPath = findOnPath('hyperframes')
  if (onPath) {
    return { command: onPath, prefix: [], source: 'path', description: `${onPath} (on PATH)` }
  }

  return {
    command: 'npx',
    prefix: ['--yes', `hyperframes@${HYPERFRAMES_VERSION}`],
    source: 'npx',
    description: `npx hyperframes@${HYPERFRAMES_VERSION}`,
  }
}

/** The first entry on PATH that is an executable file with this name. */
function findOnPath(name: string): string | null {
  const entries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  for (const entry of entries) {
    const candidate = path.join(entry, name)
    if (existsSync(candidate)) return candidate
  }
  return null
}

type DoctorPayload = {
  checks?: { name?: string; ok?: boolean; detail?: string; hint?: string }[]
}

async function probe(): Promise<ToolchainStatus> {
  const cli = resolveCli()
  const checkedAt = new Date().toISOString()

  let payload: DoctorPayload
  try {
    // `doctor --json` always exits zero, so a throw here means the CLI itself
    // could not be started — not that the machine failed a check.
    const { stdout } = await run(cli.command, [...cli.prefix, 'doctor', '--json'], {
      timeout: PROBE_TIMEOUT_MS,
      maxBuffer: 8 * 1024 * 1024,
    })
    payload = JSON.parse(stdout) as DoctorPayload
  } catch (error) {
    return {
      ready: false,
      cli,
      version: null,
      checks: [],
      error: describeCliFailure(cli, error),
      checkedAt,
    }
  }

  const checks: ToolchainCheck[] = (payload.checks ?? []).map((check) => ({
    name: check.name ?? 'Unknown',
    ok: check.ok === true,
    detail: check.detail ?? '',
    required: REQUIRED_CHECKS.has(check.name ?? ''),
    hint: check.hint,
  }))

  const version = checks.find((check) => check.name === 'Version')?.detail ?? null
  const missing = checks.filter((check) => check.required && !check.ok)

  return {
    ready: checks.length > 0 && missing.length === 0,
    cli,
    version,
    checks,
    error: null,
    checkedAt,
  }
}

function describeCliFailure(cli: ResolvedCli, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('ENOENT')) {
    return `Could not run ${cli.description}. Node 22 or newer and network access for npx are what it needs on a first run.`
  }
  if (/timed out|ETIMEDOUT/i.test(message)) {
    return `${cli.description} did not respond within ${PROBE_TIMEOUT_MS / 1000}s. On a first run it is downloading the CLI — try again once that finishes.`
  }
  return `${cli.description} failed: ${message.split('\n')[0]}`
}

/** Cached across hot reloads, like the database connection. */
const globalForToolchain = globalThis as unknown as {
  __willelementsToolchain?: { status: ToolchainStatus | null; inflight: Promise<ToolchainStatus> | null }
}

function state() {
  globalForToolchain.__willelementsToolchain ??= { status: null, inflight: null }
  return globalForToolchain.__willelementsToolchain
}

/** What the last probe found, or null if none has finished. Never blocks. */
export function cachedToolchain(): ToolchainStatus | null {
  return state().status
}

/** True while a probe is running, so the UI can say so rather than say nothing. */
export function isProbingToolchain(): boolean {
  return state().inflight !== null
}

/**
 * Runs the probe, or joins the one already running.
 *
 * Concurrent callers share a single CLI invocation — the animations page, the
 * boot-time warm-up and a render all ask this question, and asking it three
 * times means three npx processes.
 */
export function probeToolchain(options?: { refresh?: boolean }): Promise<ToolchainStatus> {
  const current = state()

  if (!options?.refresh && current.status) return Promise.resolve(current.status)
  if (current.inflight) return current.inflight

  const inflight = probe()
    .then((status) => {
      current.status = status
      return status
    })
    .finally(() => {
      current.inflight = null
    })

  current.inflight = inflight
  return inflight
}
