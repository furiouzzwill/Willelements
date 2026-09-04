'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  saveAlertSettings,
  uploadAlertSound,
  type AlertFormState,
} from '@/app/(app)/stream/alerts/actions'
import { AlertCard } from '@/components/alerts/alert-card'
import { ALERT_ANIMATION_CSS } from '@/components/alerts/animations.css'
import { CanvasPreview } from '@/components/alerts/canvas-preview'
import { Button } from '@/components/ui/button'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { Field, Input, Label } from '@/components/ui/field'
import { Panel, PanelHeader } from '@/components/ui/panel'
import {
  ENTRANCE_ANIMATIONS,
  EXIT_ANIMATIONS,
  TEMPLATE_TOKENS,
  THRESHOLD_UNITS,
  type AlertSpec,
} from '@/lib/schemas/alert'
import type { BrandDna } from '@/lib/schemas/brand'
import type { EventType, NormalizedEvent } from '@/lib/schemas/event'

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save alert'}
    </Button>
  )
}

function Feedback({ state }: { state: AlertFormState }) {
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

export function AlertEditor({
  eventType,
  initial,
  dna,
  logoUrl,
  sampleEvent,
  soundUrl,
}: {
  eventType: EventType
  initial: {
    spec: AlertSpec
    messageTemplate: string
    durationMs: number
    minThreshold: number | null
    enabled: boolean
  }
  dna: BrandDna
  logoUrl: string | null
  sampleEvent: NormalizedEvent
  soundUrl: string | null
}) {
  const [state, action] = useActionState<AlertFormState, FormData>(saveAlertSettings, {})
  const [soundState, soundAction] = useActionState<AlertFormState, FormData>(
    uploadAlertSound,
    {},
  )

  // Live preview state, mirroring the form without waiting for a save.
  const label = initial.spec.elements.find((element) => element.type === 'label')
  const [preview, setPreview] = useState({
    template: initial.messageTemplate,
    labelText: label && 'value' in label ? label.value : 'ALERT',
    layout: initial.spec.layout,
    entrance: initial.spec.entrance,
    showLogo: initial.spec.showLogo,
  })
  const [replay, setReplay] = useState(0)

  const tokens = TEMPLATE_TOKENS[eventType] ?? ['username']
  const thresholdUnit = THRESHOLD_UNITS[eventType]

  const previewSpec: AlertSpec = {
    ...initial.spec,
    layout: preview.layout,
    entrance: preview.entrance,
    showLogo: preview.showLogo,
    elements: [
      { type: 'label', value: preview.labelText, animation: 'word-reveal' },
      { type: 'username', animation: 'fade' },
    ],
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
      <form
        action={action}
        onChange={(event) => {
          // Keep the preview in step with whatever is being typed.
          const form = event.currentTarget
          const data = new FormData(form)
          setPreview({
            template: String(data.get('messageTemplate') ?? ''),
            labelText: String(data.get('labelText') ?? ''),
            layout: (data.get('layout') as AlertSpec['layout']) ?? 'centered',
            entrance: (data.get('entrance') as AlertSpec['entrance']) ?? 'fade',
            showLogo: data.get('showLogo') === 'on',
          })
        }}
        className="space-y-5"
      >
        <input type="hidden" name="eventType" value={eventType} />

        <Panel>
          <PanelHeader title="Message" />
          <div className="space-y-4 px-5 py-5">
            <Field
              label="Label"
              name="labelText"
              defaultValue={preview.labelText}
              maxLength={60}
              hint="The small line above the name."
            />

            <Field
              label="Message"
              name="messageTemplate"
              defaultValue={initial.messageTemplate}
              required
              hint={`Available: ${tokens.map((token) => `{{${token}}}`).join(', ')}`}
            />

            <div className="space-y-1.5">
              <Label htmlFor="durationMs">Duration</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="durationMs"
                  name="durationMs"
                  type="number"
                  min={1000}
                  max={30000}
                  step={500}
                  defaultValue={initial.durationMs}
                  className="w-32"
                />
                <span className="text-sm text-ink-subtle">milliseconds on screen</span>
              </div>
            </div>

            {thresholdUnit ? (
              <div className="space-y-1.5">
                <Label htmlFor="minThreshold">Minimum {thresholdUnit}</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="minThreshold"
                    name="minThreshold"
                    type="number"
                    min={1}
                    placeholder="Any"
                    defaultValue={initial.minThreshold ?? ''}
                    className="w-32"
                  />
                  <span className="text-sm text-ink-subtle">
                    below this, the alert stays quiet
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Appearance" description="Styled from your Brand DNA" />
          <div className="space-y-5 px-5 py-5">
            <ChoiceGroup
              label="Layout"
              name="layout"
              options={['centered', 'left', 'right', 'banner']}
              defaultValue={initial.spec.layout}
            />
            <ChoiceGroup
              label="Entrance"
              name="entrance"
              options={ENTRANCE_ANIMATIONS}
              defaultValue={initial.spec.entrance}
            />
            <ChoiceGroup
              label="Exit"
              name="exit"
              options={EXIT_ANIMATIONS}
              defaultValue={initial.spec.exit}
            />
            <ChoiceGroup
              label="Label animation"
              name="labelAnimation"
              options={['word-reveal', 'fade', 'scale', 'none']}
              defaultValue={label?.animation ?? 'word-reveal'}
            />
            <ChoiceGroup
              label="Name animation"
              name="usernameAnimation"
              options={['fade', 'scale', 'none']}
              defaultValue={
                initial.spec.elements.find((element) => element.type === 'username')
                  ?.animation ?? 'fade'
              }
            />

            <label className="flex items-center gap-2.5 text-sm text-ink-muted">
              <input
                type="checkbox"
                name="showLogo"
                defaultChecked={initial.spec.showLogo}
                className="size-4 accent-[var(--color-accent)]"
              />
              Show my logo above the alert
            </label>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Sound" />
          <div className="space-y-4 px-5 py-5">
            {soundUrl ? (
              <div className="space-y-2">
                <audio src={soundUrl} controls className="w-full" />
              </div>
            ) : (
              <p className="text-sm text-ink-subtle">No sound set for this alert.</p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="volume">Volume</Label>
              <input
                id="volume"
                name="volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                defaultValue={initial.spec.volume}
                className="w-full accent-[var(--color-accent)]"
              />
            </div>
          </div>
        </Panel>

        <label className="flex items-center gap-2.5 text-sm text-ink-muted">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={initial.enabled}
            className="size-4 accent-[var(--color-accent)]"
          />
          This alert is enabled
        </label>

        <div className="flex items-center gap-3">
          <SaveButton />
          <Feedback state={state} />
        </div>
      </form>

      <div className="space-y-5 lg:sticky lg:top-8">
        <Panel>
          <PanelHeader title="Preview" description="Exactly what plays in OBS" />
          <div className="space-y-3 px-5 py-5">
            <style dangerouslySetInnerHTML={{ __html: ALERT_ANIMATION_CSS }} />
            <CanvasPreview>
              <AlertCard
                key={replay}
                event={sampleEvent}
                spec={previewSpec}
                messageTemplate={preview.template}
                dna={dna}
                logoUrl={logoUrl}
              />
            </CanvasPreview>

            <button
              type="button"
              onClick={() => setReplay((count) => count + 1)}
              className="text-sm font-medium text-accent hover:underline"
            >
              Replay
            </button>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Add a sound" />
          <form action={soundAction} className="space-y-3 px-5 py-5">
            <input type="hidden" name="eventType" value={eventType} />
            <input
              type="file"
              name="sound"
              accept="audio/mpeg,audio/wav,.mp3,.wav"
              required
              className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface-raised file:px-3 file:py-1.5 file:text-sm file:text-ink hover:file:border-line-strong"
            />
            <Button type="submit" variant="secondary" size="sm">
              Upload sound
            </Button>
            <Feedback state={soundState} />
          </form>
        </Panel>
      </div>
    </div>
  )
}
