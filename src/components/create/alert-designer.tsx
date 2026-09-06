'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  applyDesignedSpec,
  designAlertAction,
  type AlertFormState,
  type DesignFormState,
} from '@/app/(app)/stream/alerts/actions'
import { AlertCard } from '@/components/alerts/alert-card'
import { ALERT_ANIMATION_CSS } from '@/components/alerts/animations.css'
import { CanvasPreview } from '@/components/alerts/canvas-preview'
import { Button, ButtonLink } from '@/components/ui/button'
import { Label } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import type { BrandDna } from '@/lib/schemas/brand'
import { DEFAULT_TEMPLATES, type AlertSpec } from '@/lib/schemas/alert'
import { EVENT_LABELS, type EventType, type NormalizedEvent } from '@/lib/schemas/event'

/**
 * The alert half of the AI Create studio.
 *
 * The same generator the alert editor uses, with the pieces that page supplies
 * for free supplied here instead: which event you are designing for, a preview
 * to judge it by, and an explicit save. Generating never writes anything —
 * describing four alerts to see what comes out should not quietly replace four
 * working ones.
 */

const EXAMPLES = [
  'loud and aggressive, glitchy, big name, no logo',
  'calm and minimal, just the name fading in',
  'a banner along the bottom with the logo and their message',
  'celebratory and bright, everything scaling up fast',
]

function DesignButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? 'Designing…' : 'Design it'}
    </Button>
  )
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  )
}

export function AlertDesigner({
  dna,
  logoUrl,
  samples,
  enabled,
}: {
  dna: BrandDna
  logoUrl: string | null
  /** One sample event per type, so the preview shows realistic values. */
  samples: Record<EventType, NormalizedEvent>
  enabled: boolean
}) {
  const [designState, designAction] = useActionState<DesignFormState, FormData>(
    designAlertAction,
    {},
  )
  const [saveState, saveAction] = useActionState<AlertFormState, FormData>(
    applyDesignedSpec,
    {},
  )

  const [eventType, setEventType] = useState<EventType>('channel.follow')
  const [description, setDescription] = useState('')
  const [spec, setSpec] = useState<AlertSpec | null>(null)
  const [replay, setReplay] = useState(0)

  // Replay on a loop while a design is on screen. Entrance and exit are where
  // most of the difference between two designs lives, and they are over in
  // under a second — a still frame of a glitch and a still frame of a fade are
  // the same picture, which is what made every design look identical.
  useEffect(() => {
    if (!spec) return
    const timer = setInterval(() => setReplay((count) => count + 1), 3200)
    return () => clearInterval(timer)
  }, [spec])

  // Apply once per result, so a re-render cannot re-apply a design over an
  // edit made since.
  const applied = useRef<unknown>(null)
  useEffect(() => {
    if (designState.spec && designState.spec !== applied.current) {
      applied.current = designState.spec
      setSpec(designState.spec as AlertSpec)
      setReplay((count) => count + 1)
    }
  }, [designState.spec])

  const label = spec?.elements.find((element) => element.type === 'label')

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <form action={designAction} className="space-y-4 px-5 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="designer-event">Which alert</Label>
          <Select
            id="designer-event"
            name="eventType"
            value={eventType}
            onChange={(event) => setEventType(event.target.value as EventType)}
          >
            {(Object.keys(EVENT_LABELS) as EventType[]).map((type) => (
              <option key={type} value={type}>
                {EVENT_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="designer-description">Describe it</Label>
          <textarea
            id="designer-description"
            name="description"
            rows={3}
            maxLength={600}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="e.g. loud and glitchy, big name, no logo"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
          />
          <p className="text-xs text-ink-subtle">
            Your Brand DNA supplies the colours and type. This decides the layout, which
            elements appear, and how they move.
          </p>
        </div>

        <ul className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => setDescription(example)}
                className="rounded-md bg-surface-raised px-2 py-1 text-left text-xs text-ink-subtle transition-colors hover:bg-accent-soft hover:text-ink focus:outline-none"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>

        {designState.error ? (
          <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
            {designState.error}
          </p>
        ) : null}

        {enabled ? (
          <DesignButton />
        ) : (
          <p className="text-sm text-ink-subtle">
            Add an OpenAI API key to design alerts by description.
          </p>
        )}
      </form>

      <div className="space-y-3 px-5 py-4 lg:border-l lg:border-line">
        <p className="font-display text-xs font-medium tracking-wide text-ink-subtle uppercase">
          Preview
        </p>

        <style dangerouslySetInnerHTML={{ __html: ALERT_ANIMATION_CSS }} />
        <CanvasPreview>
          {spec ? (
            <AlertCard
              key={replay}
              event={samples[eventType]}
              spec={spec}
              messageTemplate={DEFAULT_TEMPLATES[eventType] ?? "{{username}}"}
              dna={dna}
              logoUrl={logoUrl}
            />
          ) : null}
        </CanvasPreview>

        {spec ? (
          <>
            <dl className="space-y-1 text-xs text-ink-subtle">
              <div className="flex justify-between gap-2">
                <dt>Layout</dt>
                <dd className="text-ink-muted">{spec.layout}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>In / out</dt>
                <dd className="text-ink-muted">
                  {spec.entrance} / {spec.exit}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Logo</dt>
                <dd className="text-ink-muted">
                  {spec.showLogo
                    ? logoUrl
                      ? 'shown'
                      : 'asked for, none set'
                    : 'hidden'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Label</dt>
                <dd className="truncate text-ink-muted">
                  {label && 'value' in label ? label.value : '—'}
                </dd>
              </div>
              {/* Shown as text because two designs can differ in ways a still
                  frame cannot: which parts are present, and how loud it is. */}
              <div className="flex justify-between gap-2">
                <dt>Parts</dt>
                <dd className="truncate text-ink-muted">
                  {spec.elements.map((element) => element.type).join(', ')}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Volume</dt>
                <dd className="text-ink-muted">{Math.round(spec.volume * 100)}%</dd>
              </div>
            </dl>

            {spec.showLogo && !logoUrl ? (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                This design uses your logo, but no logo is set — so it will not appear.
                Upload one in Brand → Logos.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setReplay((count) => count + 1)}
                className="text-sm text-accent hover:underline"
              >
                Replay
              </button>
              <ButtonLink
                href={`/stream/alerts/${encodeURIComponent(eventType)}`}
                variant="ghost"
                size="sm"
              >
                Fine-tune
              </ButtonLink>
            </div>

            {/* Saving is its own submission. Generating a design to look at it
                must never overwrite the alert that is currently working. */}
            <form action={saveAction} className="space-y-2 pt-1">
              <input type="hidden" name="eventType" value={eventType} />
              <input type="hidden" name="spec" value={JSON.stringify(spec)} />
              <SaveButton label={`Save to ${EVENT_LABELS[eventType]}`} />
            </form>

            {saveState.error ? (
              <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
                {saveState.error}
              </p>
            ) : null}

            {saveState.message ? (
              <p className="rounded-lg bg-positive/10 px-3 py-2 text-sm text-positive">
                {saveState.message}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-ink-subtle">
            Describe an alert and it will play here. Nothing is saved until you press Save.
          </p>
        )}
      </div>
    </div>
  )
}
