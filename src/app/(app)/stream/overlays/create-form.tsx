'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  createOverlayAction,
  type OverlayFormState,
} from '@/app/(app)/stream/overlays/actions'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { SelectField } from '@/components/ui/select'
import { CANVAS_PRESETS } from '@/lib/schemas/overlay'

function CreateButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Creating…' : 'Create overlay'}
    </Button>
  )
}

export function CreateOverlayForm() {
  const [state, action] = useActionState<OverlayFormState, FormData>(createOverlayAction, {})

  return (
    <form action={action} className="space-y-4">
      <Field label="Name" name="name" required placeholder="Main overlay" />

      <SelectField
        label="Canvas size"
        name="canvas"
        defaultValue="1920x1080"
        hint="Match this to your OBS canvas."
        options={CANVAS_PRESETS.map((preset) => ({
          value: `${preset.width}x${preset.height}`,
          label: preset.label,
        }))}
      />

      {state.error ? (
        <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
          {state.error}
        </p>
      ) : null}

      <CreateButton />
    </form>
  )
}
