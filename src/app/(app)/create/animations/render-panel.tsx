'use client'

import { useActionState, useId, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { startRender, type RenderFormState } from '@/app/(app)/create/animations/actions'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { QUALITY_LABELS, RENDER_QUALITIES } from '@/lib/schemas/render'
import { cn } from '@/lib/utils'

/**
 * Choosing a composition and starting a render.
 *
 * One form for all the templates rather than a form per card. Three forms on a
 * page means three inputs called "headline", and either they collide or every
 * label needs a generated id to point at — complexity bought for nothing, since
 * you only ever render one thing at a time.
 */

export type TemplateSummary = {
  id: string
  name: string
  summary: string
  usage: string
  width: number
  height: number
  format: string
  loops: boolean
  usesLogo: boolean
  durationSeconds: number
  headline: { label: string; hint: string; max: number } | null
  subhead: { label: string; hint: string; max: number } | null
  defaults: { headline: string; subhead: string }
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? 'Queueing…' : 'Render'}
    </Button>
  )
}

export function RenderPanel({
  templates,
  hasLogo,
  canRender,
  blockedReason,
}: {
  templates: TemplateSummary[]
  hasLogo: boolean
  canRender: boolean
  blockedReason: string | null
}) {
  const [state, action] = useActionState<RenderFormState, FormData>(startRender, {})
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? '')
  const fieldId = useId()

  const selected = templates.find((template) => template.id === selectedId) ?? templates[0]
  if (!selected) return null

  return (
    <div className="space-y-5 px-5 py-5">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => {
          const active = template.id === selected.id
          return (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => setSelectedId(template.id)}
                aria-pressed={active}
                className={cn(
                  'h-full w-full rounded-xl border p-4 text-left transition-colors',
                  active
                    ? 'border-accent bg-accent/5'
                    : 'border-line bg-surface-raised hover:border-line-strong',
                )}
              >
                <span className="font-display block text-sm font-medium text-ink">
                  {template.name}
                </span>
                <span className="mt-1 block text-xs text-ink-subtle">{template.summary}</span>
                <span className="mt-3 flex flex-wrap gap-1.5">
                  <Tag>{template.durationSeconds.toFixed(2).replace(/\.?0+$/, '')}s</Tag>
                  <Tag>{template.format.toUpperCase()}</Tag>
                  {template.loops ? <Tag>Loops</Tag> : null}
                  {template.format === 'webm' ? <Tag>Transparent</Tag> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="rounded-xl border border-line bg-surface-raised px-4 py-3">
        <p className="text-sm text-ink-muted">{selected.usage}</p>
        {selected.usesLogo && !hasLogo ? (
          <p className="mt-1.5 text-xs text-ink-subtle">
            No logo uploaded, so this renders with your brand&apos;s initial instead. Add one
            in Brand → Logos.
          </p>
        ) : null}
      </div>

      {/* Remounted per template so the inputs reset to that template's defaults
          rather than carrying the previous one's words across. */}
      <form key={selected.id} action={action} className="space-y-4">
        <input type="hidden" name="templateId" value={selected.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          {selected.headline ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-headline`}>{selected.headline.label}</Label>
              <Input
                id={`${fieldId}-headline`}
                name="headline"
                maxLength={selected.headline.max}
                defaultValue={selected.defaults.headline}
                aria-describedby={`${fieldId}-headline-hint`}
              />
              <p id={`${fieldId}-headline-hint`} className="text-xs text-ink-subtle">
                {selected.headline.hint}
              </p>
            </div>
          ) : null}

          {selected.subhead ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-subhead`}>{selected.subhead.label}</Label>
              <Input
                id={`${fieldId}-subhead`}
                name="subhead"
                maxLength={selected.subhead.max}
                defaultValue={selected.defaults.subhead}
                aria-describedby={`${fieldId}-subhead-hint`}
              />
              <p id={`${fieldId}-subhead-hint`} className="text-xs text-ink-subtle">
                {selected.subhead.hint}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full space-y-1.5 sm:w-80">
            <Label htmlFor={`${fieldId}-quality`}>Quality</Label>
            <Select id={`${fieldId}-quality`} name="quality" defaultValue="standard">
              {RENDER_QUALITIES.map((quality) => (
                <option key={quality} value={quality}>
                  {QUALITY_LABELS[quality]}
                </option>
              ))}
            </Select>
          </div>
          <SubmitButton disabled={!canRender} />
        </div>

        {blockedReason ? (
          <p className="text-sm text-ink-subtle">{blockedReason}</p>
        ) : null}

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
    </div>
  )
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-line px-2 py-0.5 text-[11px] text-ink-subtle">
      {children}
    </span>
  )
}
