'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  applyComposition,
  applyDesignedSpec,
  composeAlertAction,
  designAlertAction,
  type AlertFormState,
  type DesignFormState,
} from '@/app/(app)/stream/alerts/actions'
import { AlertCard } from '@/components/alerts/alert-card'
import { ALERT_ANIMATION_CSS } from '@/components/alerts/animations.css'
import { CanvasPreview } from '@/components/alerts/canvas-preview'
import { CompositionFrame } from '@/components/alerts/composition-frame'
import type { Composition } from '@/lib/schemas/composition'
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

function DesignButton({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? busy : label}
    </Button>
  )
}

function SaveButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled}>
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

  // Two modes, kept apart on purpose. "Guided" composes inside the closed
  // vocabulary and cannot produce anything the app has not been taught to
  // render. "Code" has the model write a real composition, which is more
  // expressive and genuinely riskier — see schemas/composition.ts.
  const [mode, setMode] = useState<'guided' | 'code'>('guided')
  const [composition, setComposition] = useState<Composition | null>(null)
  // What the preview frame reported about itself on its current run. The
  // documented promise is that a composition is not saved until it has been
  // rendered once without throwing, and this is what makes that true rather
  // than only written down.
  const [frameStatus, setFrameStatus] = useState<{ ok: boolean; error?: string } | null>(null)

  const [composeState, composeAction] = useActionState<DesignFormState, FormData>(
    composeAlertAction,
    {},
  )
  const [compSaveState, compSaveAction] = useActionState<AlertFormState, FormData>(
    applyComposition,
    {},
  )

  const appliedComposition = useRef<unknown>(null)
  useEffect(() => {
    if (composeState.spec && composeState.spec !== appliedComposition.current) {
      appliedComposition.current = composeState.spec
      setComposition(composeState.spec as Composition)
      // A new composition has not proved anything yet, so saving waits for its
      // own preview to report rather than inheriting the last one's verdict.
      setFrameStatus(null)
      setReplay((count) => count + 1)
    }
  }, [composeState.spec])


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
      <form
        action={mode === 'code' ? composeAction : designAction}
        className="space-y-4 px-5 py-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="designer-mode">Mode</Label>
          <Select
            id="designer-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as 'guided' | 'code')}
          >
            <option value="guided">Guided — composed from the built-in vocabulary</option>
            <option value="code">Code — writes a real composition, more range</option>
          </Select>
          <p className="text-xs text-ink-subtle">
            {mode === 'code'
              ? 'Writes actual markup, CSS and JavaScript. It runs in an isolated frame with no network and no access to the app — but it is generated code, so preview it before you save.'
              : 'Composes motion from parts the app already knows how to draw. Bounded, and it cannot produce anything unrenderable.'}
          </p>
        </div>

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

        {mode === 'code' && composition ? (
          <input type="hidden" name="previous" value={JSON.stringify(composition)} />
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="designer-description">
            {mode === 'code' && composition ? 'What should change' : 'Describe it'}
          </Label>
          <textarea
            id="designer-description"
            name="description"
            rows={3}
            maxLength={600}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={
              mode === 'code' && composition
                ? 'e.g. more particles, and make the name bigger'
                : 'e.g. loud and glitchy, big name, no logo'
            }
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
          />
          <p className="text-xs text-ink-subtle">
            {mode === 'code' && composition
              ? 'Changes the composition below rather than starting again — say only what you want different. Start over clears it.'
              : 'Your Brand DNA supplies the colours and type. This decides the layout, which elements appear, and how they move.'}
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

        {(mode === 'code' ? composeState.error : designState.error) ? (
          <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
            {mode === 'code' ? composeState.error : designState.error}
          </p>
        ) : null}

        {enabled ? (
          <div className="flex flex-wrap items-center gap-3">
            <DesignButton
              label={mode === 'code' && composition ? 'Apply the change' : 'Design it'}
              busy={mode === 'code' && composition ? 'Revising…' : 'Designing…'}
            />
            {mode === 'code' && composition ? (
              <button
                type="button"
                onClick={() => {
                  setComposition(null)
                  setDescription('')
                }}
                className="text-sm text-ink-subtle hover:text-ink"
              >
                Start over
              </button>
            ) : null}
          </div>
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
          {mode === 'code' && composition ? (
            <div style={{ width: 1920, height: 1080, transformOrigin: '0 0' }}>
              <CompositionFrame
                composition={composition}
                dna={dna}
                logoUrl={logoUrl}
                replayKey={replay}
                onStatus={setFrameStatus}
                width={1920}
                height={1080}
                values={{
                  username: samples[eventType].actor.displayName,
                  amount: '150',
                  message: 'lets go',
                  label: 'ALERT',
                }}
              />
            </div>
          ) : spec ? (
            <AlertCard
              key={replay}
              motionId={`d${replay}`}
              event={samples[eventType]}
              spec={spec}
              messageTemplate={DEFAULT_TEMPLATES[eventType] ?? "{{username}}"}
              dna={dna}
              logoUrl={logoUrl}
            />
          ) : null}
        </CanvasPreview>

        {mode === 'code' && composition ? (
          <>
            <p className="text-xs text-ink-subtle">{composition.summary}</p>
            <dl className="space-y-1 text-xs text-ink-subtle">
              <div className="flex justify-between gap-2">
                <dt>Length</dt>
                <dd className="text-ink-muted">{composition.durationMs}ms</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Size</dt>
                <dd className="text-ink-muted">
                  {(composition.html.length / 1024).toFixed(1)} KB
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => setReplay((count) => count + 1)}
              className="text-sm text-accent hover:underline"
            >
              Replay
            </button>

            {/* The code is shown because it is yours: the point of this mode is
                that a real composition was written, and a thing you cannot read
                is one you have to take on trust. */}
            <details className="rounded-lg border border-line bg-canvas">
              <summary className="cursor-pointer px-3 py-2 text-xs text-ink-subtle">
                Show the code
              </summary>
              <pre className="max-h-64 overflow-auto px-3 pb-3 text-[11px] leading-relaxed text-ink-muted">
                <code>{composition.html}</code>
              </pre>
            </details>

            {frameStatus && !frameStatus.ok ? (
              <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
                This composition threw while it was running: {frameStatus.error}. Describe
                the problem above and apply the change — saving it would put a broken
                alert on your stream.
              </p>
            ) : null}

            <form action={compSaveAction} className="space-y-2 pt-1">
              <input type="hidden" name="eventType" value={eventType} />
              <input type="hidden" name="composition" value={JSON.stringify(composition)} />
              <SaveButton
                label={`Save to ${EVENT_LABELS[eventType]}`}
                disabled={frameStatus ? !frameStatus.ok : true}
              />
            </form>

            <form action={compSaveAction}>
              <input type="hidden" name="eventType" value={eventType} />
              <input type="hidden" name="clear" value="1" />
              <button type="submit" className="text-xs text-ink-subtle hover:text-ink">
                Remove the composition from this alert
              </button>
            </form>

            {compSaveState.error ? (
              <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
                {compSaveState.error}
              </p>
            ) : null}
            {compSaveState.message ? (
              <p className="rounded-lg bg-positive/10 px-3 py-2 text-sm text-positive">
                {compSaveState.message}
              </p>
            ) : null}
          </>
        ) : spec ? (
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
