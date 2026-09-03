'use client'

import { useId, useState } from 'react'

import { Label } from '@/components/ui/field'

/**
 * A colour input with a live swatch and a typeable hex value.
 *
 * Two controls edit one value: the native picker for choosing, the text box for
 * pasting a hex a creator already has. Only the text input carries the form
 * `name`, so a half-typed hex never reaches the server — the field holds the
 * last valid value until the new one parses.
 */
export function ColorField({
  label,
  name,
  defaultValue,
}: {
  label: string
  name: string
  defaultValue: string
}) {
  const [value, setValue] = useState(defaultValue)
  const [draft, setDraft] = useState(defaultValue)
  const id = useId()

  const isValid = /^#[0-9a-fA-F]{6}$/.test(draft)

  function commit(next: string) {
    setDraft(next)
    if (/^#[0-9a-fA-F]{6}$/.test(next)) setValue(next.toUpperCase())
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          aria-label={`${label} picker`}
          onChange={(event) => {
            setValue(event.target.value.toUpperCase())
            setDraft(event.target.value.toUpperCase())
          }}
          className="size-10 shrink-0 cursor-pointer rounded-lg border border-line bg-canvas p-1"
        />
        <input
          id={id}
          name={name}
          value={draft}
          onChange={(event) => commit(event.target.value)}
          onBlur={() => setDraft(value)}
          spellCheck={false}
          aria-invalid={!isValid}
          className="h-10 w-full rounded-lg border border-line bg-canvas px-3 font-mono text-sm text-ink uppercase focus:border-accent focus:outline-none aria-invalid:border-live"
        />
      </div>
    </div>
  )
}
