'use client'

import { useState } from 'react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/field'

/**
 * A row of buttons behaving as one choice. Faster to scan and click than a
 * select for short option sets, which is most of the style controls.
 */
export function ChoiceGroup({
  label,
  name,
  options,
  defaultValue,
  hint,
}: {
  label: string
  name: string
  options: readonly string[]
  defaultValue: string
  hint?: string
}) {
  const [value, setValue] = useState(defaultValue)

  return (
    <fieldset className="space-y-1.5">
      <legend className="sr-only">{label}</legend>
      <Label as="span">{label}</Label>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = option === value
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setValue(option)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm capitalize transition-colors',
                selected
                  ? 'border-accent bg-accent-soft/60 font-medium text-ink'
                  : 'border-line bg-surface-raised text-ink-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {option.replace(/-/g, ' ')}
            </button>
          )
        })}
      </div>
      {hint ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
    </fieldset>
  )
}

/** Same shape, but several options can be selected at once. */
export function MultiChoiceGroup({
  label,
  name,
  options,
  defaultValue,
  hint,
}: {
  label: string
  name: string
  options: readonly string[]
  defaultValue: string[]
  hint?: string
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue)

  function toggle(option: string) {
    setSelected((current) =>
      current.includes(option)
        ? // Never let the set empty out — downstream generation expects at least one.
          current.length > 1
          ? current.filter((item) => item !== option)
          : current
        : [...current, option],
    )
  }

  return (
    <fieldset className="space-y-1.5">
      <legend className="sr-only">{label}</legend>
      <Label as="span">{label}</Label>
      {selected.map((option) => (
        <input key={option} type="hidden" name={name} value={option} />
      ))}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isOn = selected.includes(option)
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isOn}
              onClick={() => toggle(option)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm capitalize transition-colors',
                isOn
                  ? 'border-accent bg-accent-soft/60 font-medium text-ink'
                  : 'border-line bg-surface-raised text-ink-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {option.replace(/-/g, ' ')}
            </button>
          )
        })}
      </div>
      {hint ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
    </fieldset>
  )
}
