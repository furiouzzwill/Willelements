import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/field'

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-10 w-full appearance-none rounded-lg border border-line bg-canvas px-3 text-sm text-ink',
        'focus:border-accent focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function SelectField({
  label,
  name,
  options,
  hint,
  ...props
}: ComponentProps<'select'> & {
  label: string
  name: string
  hint?: string
  options: readonly { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Select id={name} name={name} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {hint ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  )
}

/** Turns a const array of slugs into select options with readable labels. */
export function optionsFrom(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' '),
  }))
}
