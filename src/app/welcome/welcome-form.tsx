'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { completeWelcome, type WelcomeState } from '@/app/welcome/actions'
import { Button } from '@/components/ui/button'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { ColorField } from '@/components/ui/color-field'
import { Field } from '@/components/ui/field'
import { VISUAL_STYLES } from '@/lib/schemas/brand'

function ContinueButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Setting up…' : 'Create my brand'}
    </Button>
  )
}

export function WelcomeForm({ defaults }: { defaults: { primary: string; background: string } }) {
  const [state, action] = useActionState<WelcomeState, FormData>(completeWelcome, {})

  return (
    <form action={action} className="space-y-5">
      <Field
        label="What's your channel called?"
        name="name"
        required
        autoFocus
        placeholder="NightShift Gaming"
        hint="You can change this, and everything else, later."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField label="Main colour" name="primary" defaultValue={defaults.primary} />
        <ColorField label="Background" name="background" defaultValue={defaults.background} />
      </div>

      <ChoiceGroup
        label="Which of these fits your channel?"
        name="style"
        options={VISUAL_STYLES}
        defaultValue="gaming"
      />

      {state.error ? (
        <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
          {state.error}
        </p>
      ) : null}

      <ContinueButton />
    </form>
  )
}
