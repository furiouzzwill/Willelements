import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cn('block text-sm font-medium text-ink-muted', className)}
      {...props}
    />
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink',
        'placeholder:text-ink-subtle',
        'focus:border-accent focus:outline-none focus-visible:outline-none',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

/**
 * A labelled input with room for a per-field error. `error` is rendered with
 * `role="alert"` and wired to the input through `aria-describedby`.
 */
export function Field({
  label,
  name,
  error,
  hint,
  ...props
}: ComponentProps<'input'> & { label: string; name: string; error?: string; hint?: string }) {
  const describedBy = [error ? `${name}-error` : null, hint ? `${name}-hint` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {hint ? (
        <p id={`${name}-hint`} className="text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} role="alert" className="text-xs text-live">
          {error}
        </p>
      ) : null}
    </div>
  )
}
