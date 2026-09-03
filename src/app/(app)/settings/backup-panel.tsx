'use client'

import { useActionState, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { restoreBackup, type RestoreState } from '@/app/(app)/settings/actions'
import { Button, buttonStyles } from '@/components/ui/button'
import { Panel, PanelHeader } from '@/components/ui/panel'

function RestoreButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={disabled || pending}>
      {pending ? 'Restoring…' : 'Restore from backup'}
    </Button>
  )
}

export function BackupPanel() {
  const [state, formAction] = useActionState<RestoreState, FormData>(restoreBackup, {})
  const [fileName, setFileName] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Panel>
      <PanelHeader
        title="Backup"
        description="Everything you have, in one file"
      />

      <div className="space-y-5 px-5 py-5">
        <div className="space-y-2">
          <a href="/api/backup/export" className={buttonStyles({ size: 'sm' })}>
            Download backup
          </a>
          <p className="text-sm text-ink-subtle">
            A zip containing your database and every asset. The database is captured as a
            consistent snapshot, so it is safe to do this while the app is running.
          </p>
        </div>

        <form action={formAction} className="space-y-3 border-t border-line pt-5">
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="file"
              name="backup"
              accept=".zip,application/zip"
              onChange={(event) => {
                setFileName(event.target.files?.[0]?.name ?? null)
                setConfirmed(false)
              }}
              className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface-raised file:px-3 file:py-1.5 file:text-sm file:text-ink hover:file:border-line-strong"
            />
            <p className="text-sm text-ink-subtle">
              Restoring <span className="text-ink">replaces everything</span> currently in
              this app. Your existing database is saved beside the restored one first, so a
              mistake is recoverable.
            </p>
          </div>

          {fileName ? (
            <label className="flex items-start gap-2.5 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 size-4 accent-[var(--color-accent)]"
              />
              <span>
                Replace my current data with{' '}
                <span className="font-mono text-xs text-ink">{fileName}</span>
              </span>
            </label>
          ) : null}

          <RestoreButton disabled={!fileName || !confirmed} />

          {state.error ? (
            <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
              {state.error}
            </p>
          ) : null}

          {state.message ? (
            <p
              role="status"
              className="rounded-lg bg-positive/10 px-3 py-2 text-sm text-positive"
            >
              {state.message}
            </p>
          ) : null}
        </form>
      </div>
    </Panel>
  )
}
