'use client'

import { useActionState, useRef } from 'react'
import { useFormStatus } from 'react-dom'

import { uploadLogo, type FormState } from '@/app/(app)/brand/actions'
import { Button } from '@/components/ui/button'

function UploadButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Uploading…' : 'Upload logo'}
    </Button>
  )
}

export function UploadForm() {
  const [state, action] = useActionState<FormState, FormData>(uploadLogo, {})
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await action(formData)
        formRef.current?.reset()
      }}
      className="space-y-3"
    >
      <input
        type="file"
        name="logo"
        accept="image/png,image/jpeg,image/gif,image/webp"
        required
        className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface-raised file:px-3 file:py-1.5 file:text-sm file:text-ink hover:file:border-line-strong"
      />

      <p className="text-sm text-ink-subtle">
        PNG, JPEG, GIF or WebP, up to 25 MB. A transparent PNG works best over stream
        footage. Files are checked by their contents, not their name.
      </p>

      <UploadButton />

      {state.error ? (
        <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm text-positive">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
