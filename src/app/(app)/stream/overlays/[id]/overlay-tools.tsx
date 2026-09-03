'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { testAlertAction, type OverlayFormState } from '@/app/(app)/stream/overlays/actions'
import { Button } from '@/components/ui/button'
import { EVENT_LABELS, EVENT_TYPES, type EventType } from '@/lib/schemas/event'

/** Copies the browser-source URL, with the confirmation people expect. */
export function CopyUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink">
          {url}
        </code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch {
              // Clipboard can be blocked; the URL is selectable either way.
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}

function TestButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? 'Sending…' : label}
    </Button>
  )
}

/**
 * Fires test events through the real pipeline.
 *
 * The same normalization, the same queue, the same browser source a live
 * Twitch event will use — so a working test means the path works, not that a
 * mock of it does.
 */
export function TestAlerts({ overlayId }: { overlayId: string }) {
  const [state, action] = useActionState<OverlayFormState, FormData>(testAlertAction, {})

  const types: EventType[] = EVENT_TYPES.filter(
    (type) => type !== 'stream.online' && type !== 'stream.offline',
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {types.map((type) => (
          <form key={type} action={action}>
            <input type="hidden" name="overlayId" value={overlayId} />
            <input type="hidden" name="eventType" value={type} />
            <TestButton label={EVENT_LABELS[type]} />
          </form>
        ))}
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm text-positive">
          {state.message}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A live preview of the overlay, in an iframe pointed at the real URL.
 *
 * It is the same page OBS loads, connected the same way — so it also acts as a
 * second listener, which is what makes Test Alert useful before OBS is set up.
 */
export function OverlayPreview({ url, width, height }: { url: string; width: number; height: number }) {
  const [visible, setVisible] = useState(true)

  return (
    <div className="space-y-3">
      <div
        className="relative w-full overflow-hidden rounded-lg border border-line"
        style={{ aspectRatio: `${width} / ${height}`, background: '#0b1020' }}
      >
        {/* A stand-in for gameplay, so transparency is judged honestly. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(60% 60% at 25% 30%, #1e3a5f, transparent), radial-gradient(50% 50% at 80% 70%, #3b1e5f, transparent)',
          }}
        />
        {visible ? (
          <iframe
            src={url}
            title="Overlay preview"
            className="absolute inset-0 size-full border-0"
            // The overlay needs no privileges; it only reads its own stream.
            sandbox="allow-scripts allow-same-origin"
          />
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setVisible((on) => !on)}
        className="text-sm font-medium text-accent hover:underline"
      >
        {visible ? 'Disconnect preview' : 'Reconnect preview'}
      </button>
    </div>
  )
}
