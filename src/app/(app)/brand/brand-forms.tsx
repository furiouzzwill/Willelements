'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { saveDna, saveIdentity, type FormState } from '@/app/(app)/brand/actions'
import { Button } from '@/components/ui/button'
import { ChoiceGroup, MultiChoiceGroup } from '@/components/ui/choice-group'
import { ColorField } from '@/components/ui/color-field'
import { Field } from '@/components/ui/field'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { SelectField } from '@/components/ui/select'
import { TagInput } from '@/components/ui/tag-input'
import { TextareaField } from '@/components/ui/textarea'
import { MOTION_STYLES, VISUAL_STYLES, type BrandDna } from '@/lib/schemas/brand'
import type { BrandWithDna } from '@/lib/services/brand-service'

function SaveButton({ label = 'Save' }: { label?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  )
}

function Feedback({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
        {state.error}
      </p>
    )
  }
  if (state.message) {
    return (
      <p role="status" className="text-sm text-positive">
        {state.message}
      </p>
    )
  }
  return null
}

export function IdentityForm({ brand }: { brand: BrandWithDna }) {
  const [state, action] = useActionState<FormState, FormData>(saveIdentity, {})

  return (
    <Panel>
      <PanelHeader title="Identity" description="Who you are and who you make for" />
      <form action={action} className="space-y-4 px-5 py-5">
        <Field
          label="Brand name"
          name="name"
          defaultValue={brand.name}
          required
          error={state.fieldErrors?.name}
        />

        <TextareaField
          label="Description"
          name="description"
          defaultValue={brand.description ?? ''}
          placeholder="Late-night gaming and technology creator."
          hint="One or two sentences. This feeds generation prompts later."
        />

        <Field
          label="Audience"
          name="audience"
          defaultValue={brand.audience ?? ''}
          placeholder="Gamers ages 18–35"
        />

        <SelectField
          label="Creator type"
          name="creatorType"
          defaultValue={brand.creatorType ?? 'streamer'}
          options={[
            { value: 'streamer', label: 'Streamer' },
            { value: 'youtuber', label: 'YouTuber' },
            { value: 'podcaster', label: 'Podcaster' },
            { value: 'business', label: 'Business' },
            { value: 'other', label: 'Other' },
          ]}
        />

        <div className="flex items-center gap-3">
          <SaveButton label="Save identity" />
          <Feedback state={state} />
        </div>
      </form>
    </Panel>
  )
}

export function DnaForm({ dna }: { dna: BrandDna }) {
  const [state, action] = useActionState<FormState, FormData>(saveDna, {})

  return (
    <form id="brand-dna-form" action={action} className="space-y-5">
      <Panel>
        <PanelHeader title="Colors" description="Used by every overlay, alert and graphic" />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <ColorField label="Primary" name="primary" defaultValue={dna.colors.primary} />
          <ColorField label="Secondary" name="secondary" defaultValue={dna.colors.secondary} />
          <ColorField label="Accent" name="accent" defaultValue={dna.colors.accent} />
          <ColorField label="Background" name="background" defaultValue={dna.colors.background} />
          <ColorField label="Text" name="text" defaultValue={dna.colors.text} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Typography" />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field
            label="Heading font"
            name="heading"
            defaultValue={dna.typography.heading}
            hint="Any font installed on this machine, or a common web font."
          />
          <Field label="Body font" name="body" defaultValue={dna.typography.body} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Visual style" description="How generated graphics should look" />
        <div className="space-y-5 px-5 py-5">
          <ChoiceGroup
            label="Canvas"
            name="canvas"
            options={['dark', 'light']}
            defaultValue={dna.visualStyle.canvas}
          />
          <ChoiceGroup
            label="Style"
            name="style"
            options={VISUAL_STYLES}
            defaultValue={dna.visualStyle.style}
          />
          <ChoiceGroup
            label="Detail"
            name="detail"
            options={['minimal', 'balanced', 'detailed']}
            defaultValue={dna.visualStyle.detail}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Motion style" description="How your animations should move" />
        <div className="space-y-5 px-5 py-5">
          <ChoiceGroup
            label="Energy"
            name="energy"
            options={['low', 'medium', 'high']}
            defaultValue={dna.motionStyle.energy}
          />
          <ChoiceGroup
            label="Speed"
            name="speed"
            options={['slow', 'medium', 'fast']}
            defaultValue={dna.motionStyle.speed}
          />
          <MultiChoiceGroup
            label="Character"
            name="motionStyle"
            options={MOTION_STYLES}
            defaultValue={dna.motionStyle.style}
            hint="Pick as many as fit. At least one is always kept."
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Personality & rules"
          description="What to lean into, and what to never produce"
        />
        <div className="space-y-5 px-5 py-5">
          <TagInput
            label="Personality"
            name="personality"
            defaultValue={dna.personality}
            placeholder="futuristic"
            hint="Adjectives that describe the feel of your channel."
          />
          <TagInput
            label="Prefer"
            name="prefer"
            defaultValue={dna.rules.prefer}
            placeholder="thin neon borders"
          />
          <TagInput
            label="Avoid"
            name="avoid"
            defaultValue={dna.rules.avoid}
            placeholder="cartoon illustrations"
            hint="Anything here is excluded from generated assets."
          />
        </div>
      </Panel>

      <div className="flex items-center gap-3">
        <SaveButton label="Save brand DNA" />
        <Feedback state={state} />
      </div>
    </form>
  )
}
