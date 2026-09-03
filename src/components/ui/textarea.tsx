import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/field'

export function TextareaField({
  label,
  name,
  hint,
  error,
  className,
  ...props
}: ComponentProps<'textarea'> & {
  label: string
  name: string
  hint?: string
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <textarea
        id={name}
        name={name}
        rows={3}
        aria-invalid={error ? true : undefined}
        className={cn(
          'w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink',
          'placeholder:text-ink-subtle focus:border-accent focus:outline-none',
          className,
        )}
        {...props}
      />
      {hint ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-live">
          {error}
        </p>
      ) : null}
    </div>
  )
}
