'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { designAlertAction, type DesignFormState } from '@/app/(app)/stream/alerts/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/field'
import type { AlertSpec } from '@/lib/schemas/alert'
import type { EventType } from '@/lib/schemas/event'

/**
 * Describe an alert in words; the app fills in the controls.
 *
 * What comes back is a **specification**, not code — the closed element set in
 * `schemas/alert.ts` is what the model is allowed to choose from, and the
 * result is parsed by that schema before it reaches this component. See
 * `docs/ai-generation.md`: this is a security boundary, not a preference.
 *
 * Nothing is saved. The design lands in the form beside its live preview, so it
 * can be looked at and adjusted before Save. Generating costs a fraction of a
 * cent; silently replacing a working alert would cost more than that to undo.
 */

const EXAMPLES = [
  'loud and aggressive, glitchy, big name, no logo',
  'calm and minimal, just the name fading in',
  'a banner along the bottom with the logo and their message',
]

function DesignButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? 'Designing…' : 'Design it'}
    </Button>
  )
}

export function DesignPanel({
  eventType,
  onApply,
  disabled,
}: {
  eventType: EventType
  onApply: (spec: AlertSpec) => void
  disabled: boolean
}) {
  const [state, action] = useActionState<DesignFormState, FormData>(designAlertAction, {})

  // The examples were rendered as pills and did nothing, which is worse than
  // not showing them: anything shaped like a button is a button as far as the
  // person reading it is concerned. Controlled so clicking one fills the box.
  const [description, setDescription] = useState('')

  // Apply once per result. Without the guard, every re-render of the parent
  // would re-apply the same spec and stamp over edits made since.
  const applied = useRef<unknown>(null)
  useEffect(() => {
    if (state.spec && state.spec !== applied.current) {
      applied.current = state.spec
      onApply(state.spec as AlertSpec)
    }
  }, [state.spec, onApply])

  return (
    <form action={action} className="space-y-3 px-5 py-4">
      <input type="hidden" name="eventType" value={eventType} />

      <div className="space-y-1.5">
        <Label htmlFor="design-description">Describe it</Label>
        <textarea
          id="design-description"
          name="description"
          rows={2}
          maxLength={600}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="e.g. loud and glitchy, big name, no logo"
          className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
        />
        <p className="text-xs text-ink-subtle">
          Your Brand DNA supplies the colours and type — this decides the layout, which
          elements appear, and how they move.
        </p>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <li key={example}>
            <button
              type="button"
              onClick={() => setDescription(example)}
              className="rounded-md bg-surface-raised px-2 py-1 text-left text-xs text-ink-subtle transition-colors hover:bg-accent-soft hover:text-ink focus:border-accent focus:outline-none"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
          {state.error}
        </p>
      ) : null}

      {state.message ? (
        <p className="rounded-lg bg-positive/10 px-3 py-2 text-sm text-positive">
          {state.message}
        </p>
      ) : null}

      {disabled ? (
        <p className="text-sm text-ink-subtle">
          Add an OpenAI API key to design alerts by description.
        </p>
      ) : (
        <DesignButton />
      )}
    </form>
  )
}
