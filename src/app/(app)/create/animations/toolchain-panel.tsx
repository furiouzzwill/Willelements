'use client'

import { useFormStatus } from 'react-dom'

import { recheckToolchain } from '@/app/(app)/create/animations/actions'
import { Button } from '@/components/ui/button'
import type { ToolchainStatus } from '@/lib/hyperframes/toolchain'

/**
 * What the renderer needs, and whether this machine has it.
 *
 * Shown plainly rather than hidden behind a working Render button. Rendering
 * depends on software this app does not ship — FFmpeg, a headless Chrome, the
 * HyperFrames CLI — and a page that pretends otherwise turns a missing
 * dependency into a mysterious failure minutes later.
 */

function RecheckButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? 'Checking…' : 'Check again'}
    </Button>
  )
}

export function ToolchainPanel({
  status,
  probing,
}: {
  status: ToolchainStatus | null
  probing: boolean
}) {
  const required = status?.checks.filter((check) => check.required) ?? []
  const missing = required.filter((check) => !check.ok)

  return (
    <div className="space-y-4 px-5 py-5">
      {status === null ? (
        <p className="text-sm text-ink-muted">
          {probing
            ? 'Checking what this machine can render with. The first run downloads the HyperFrames CLI, which can take a minute.'
            : 'The render toolchain has not been checked yet.'}
        </p>
      ) : status.error ? (
        <div className="space-y-1.5">
          <p className="text-sm text-live">{status.error}</p>
          <p className="text-xs text-ink-subtle">
            Looked for it as <code>{status.cli.description}</code>.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            {status.ready
              ? 'Ready to render.'
              : `Cannot render: ${missing.map((check) => check.name).join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing.`}{' '}
            Using <code>{status.cli.description}</code>
            {status.version ? ` · ${status.version}` : ''}
          </p>

          <ul className="grid gap-2 sm:grid-cols-2">
            {required.map((check) => (
              <li key={check.name} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${check.ok ? 'bg-positive' : 'bg-live'}`}
                />
                <span className="min-w-0">
                  <span className="text-ink">{check.name}</span>
                  <span className="sr-only">{check.ok ? ' available' : ' missing'}</span>
                  <span className="block truncate text-xs text-ink-subtle">{check.detail}</span>
                </span>
              </li>
            ))}
          </ul>

          {missing.length > 0 ? (
            <ul className="space-y-1 text-xs text-ink-subtle">
              {missing.map((check) => (
                <li key={check.name}>
                  <strong className="text-ink-muted">{check.name}:</strong>{' '}
                  {check.hint ?? 'Install it and check again.'}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      <form action={recheckToolchain}>
        <RecheckButton />
      </form>
    </div>
  )
}
