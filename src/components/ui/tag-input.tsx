'use client'

import { useId, useState } from 'react'

import { Icon } from '@/components/ui/icon'
import { Label } from '@/components/ui/field'

/**
 * A list of short free-text values — brand personality, prefer/avoid rules.
 *
 * These end up in generation prompts, where the useful entries are specific
 * ("thin neon borders") in a way a fixed list could not anticipate, so this
 * stays free text rather than a picker.
 *
 * The values are submitted as repeated fields under one name, which
 * `formData.getAll()` reads back as an array.
 */
export function TagInput({
  label,
  name,
  hint,
  placeholder,
  defaultValue = [],
  max = 20,
}: {
  label: string
  name: string
  hint?: string
  placeholder?: string
  defaultValue?: string[]
  max?: number
}) {
  const [tags, setTags] = useState<string[]>(defaultValue)
  const [draft, setDraft] = useState('')
  const id = useId()

  function add() {
    const value = draft.trim()
    if (!value || tags.length >= max) return
    if (tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      setDraft('')
      return
    }
    setTags([...tags, value])
    setDraft('')
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>

      {tags.map((tag) => (
        <input key={tag} type="hidden" name={name} value={tag} />
      ))}

      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-raised py-1 pr-1.5 pl-3 text-sm text-ink"
          >
            {tag}
            <button
              type="button"
              onClick={() => setTags(tags.filter((item) => item !== tag))}
              aria-label={`Remove ${tag}`}
              className="grid size-5 place-items-center rounded-full text-ink-subtle hover:bg-line hover:text-ink"
            >
              <span aria-hidden="true">×</span>
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter adds a tag rather than submitting the surrounding form.
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              add()
            }
          }}
          disabled={tags.length >= max}
          className="h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || tags.length >= max}
          aria-label={`Add to ${label}`}
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-surface-raised text-ink-muted hover:border-line-strong hover:text-ink disabled:opacity-40"
        >
          <Icon name="plus" />
        </button>
      </div>

      {hint ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  )
}
