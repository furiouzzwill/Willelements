'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import type { AuthFormState } from '@/app/(auth)/actions'

type Action = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Working…' : label}
    </Button>
  )
}

export function AuthForm({
  action,
  submitLabel,
  includeDisplayName = false,
  next,
}: {
  action: Action
  submitLabel: string
  includeDisplayName?: boolean
  next?: string
}) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {})

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {includeDisplayName ? (
        <Field
          label="Creator name"
          name="displayName"
          autoComplete="nickname"
          required
          placeholder="NightShift Gaming"
          error={state.fieldErrors?.displayName}
        />
      ) : null}

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        error={state.fieldErrors?.email}
      />

      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={includeDisplayName ? 'new-password' : 'current-password'}
        required
        placeholder="••••••••"
        hint={includeDisplayName ? 'At least 8 characters.' : undefined}
        error={state.fieldErrors?.password}
      />

      {state.error ? (
        <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
          {state.error}
        </p>
      ) : null}

      <SubmitButton label={submitLabel} />
    </form>
  )
}
