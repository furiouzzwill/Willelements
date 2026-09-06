'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import type { CreateFormState } from '@/app/(app)/create/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import {
  estimateCost,
  formatCost,
  MODELS,
  type ImageModel,
  type ImageQuality,
  type ImageSize,
} from '@/lib/providers/openai/pricing'
import { QUALITY_LABELS } from '@/lib/schemas/image'

/**
 * The form that spends money.
 *
 * The estimated cost updates as you change model and quality, and sits beside
 * the button rather than in a panel elsewhere — the moment to know what
 * something costs is while deciding to buy it, not afterwards.
 *
 * Fields are assembled from the primitives rather than from `SelectField`,
 * because several of these forms render on one page and the field helpers
 * derive their `id` from `name`. The name has to stay `model` for the action to
 * read it, so the id is what varies.
 */

function SubmitButton({ label, cost }: { label: string; cost: string }) {
  const { pending } = useFormStatus()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? 'Generating…' : label}
      </Button>
      <span className="text-sm text-ink-subtle">
        Estimated <span className="tabular-nums text-ink-muted">{cost}</span>
      </span>
    </div>
  )
}

export function GenerateForm({
  action,
  subjectId,
  sizes,
  label = 'Generate',
  disabled = false,
}: {
  action: (prev: CreateFormState, formData: FormData) => Promise<CreateFormState>
  subjectId?: string
  /**
   * Every image this submission makes, by size.
   *
   * A list rather than a size and a count, because a package mixes square and
   * rectangular pieces and they are not priced the same. Multiplying one size
   * by four would quote a number that is wrong for the thing the button makes.
   */
  sizes: ImageSize[]
  label?: string
  disabled?: boolean
}) {
  const [state, formAction] = useActionState(action, {} as CreateFormState)
  const [model, setModel] = useState<ImageModel>(MODELS[0].id)
  const [quality, setQuality] = useState<ImageQuality>('medium')

  // Null anywhere means the total is unknowable, not that those images are
  // free — so one unpriced piece makes the whole quote unknown.
  const perImage = sizes.map((size) => estimateCost(model, quality, size))
  const total = perImage.every((value) => value !== null)
    ? Math.round(perImage.reduce((sum: number, value) => sum + value, 0) * 10_000) / 10_000
    : null
  const cost = formatCost(total)
  const selected = MODELS.find((entry) => entry.id === model)
  const uid = subjectId ?? 'package'

  return (
    <form action={formAction} className="space-y-4 px-5 py-4">
      {subjectId ? <input type="hidden" name="subjectId" value={subjectId} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`model-${uid}`}>Model</Label>
          <Select
            id={`model-${uid}`}
            name="model"
            value={model}
            onChange={(event) => setModel(event.target.value as ImageModel)}
          >
            {MODELS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.price === null ? `${entry.label} — price unknown` : entry.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`quality-${uid}`}>Quality</Label>
          <Select
            id={`quality-${uid}`}
            name="quality"
            value={quality}
            onChange={(event) => setQuality(event.target.value as ImageQuality)}
          >
            {(Object.keys(QUALITY_LABELS) as ImageQuality[]).map((value) => (
              <option key={value} value={value}>
                {QUALITY_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {selected ? <p className="text-xs text-ink-subtle">{selected.description}</p> : null}

      <div className="space-y-1.5">
        <Label htmlFor={`extra-${uid}`}>Anything to add</Label>
        <textarea
          id={`extra-${uid}`}
          name="extra"
          rows={2}
          maxLength={400}
          placeholder="e.g. a fox motif, hexagon shapes"
          className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
        />
        <p className="text-xs text-ink-subtle">
          Optional. Your Brand DNA is already in the prompt — this steers it.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
          {state.error}
        </p>
      ) : null}

      {state.message ? (
        <p className="rounded-lg bg-positive/10 px-3 py-2 text-sm text-positive">
          {state.message}
        </p>
      ) : null}

      {disabled ? (
        <p className="text-sm text-ink-subtle">Add an OpenAI API key to generate.</p>
      ) : (
        <SubmitButton label={label} cost={cost} />
      )}
    </form>
  )
}
