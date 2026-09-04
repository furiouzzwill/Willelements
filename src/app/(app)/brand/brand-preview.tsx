'use client'

import { useEffect, useState } from 'react'

import { AlertCard } from '@/components/alerts/alert-card'
import { ALERT_ANIMATION_CSS } from '@/components/alerts/animations.css'
import { CanvasPreview } from '@/components/alerts/canvas-preview'
import { defaultSpecFor } from '@/lib/schemas/alert'
import type { BrandDna } from '@/lib/schemas/brand'
import type { NormalizedEvent } from '@/lib/schemas/event'

/**
 * Live preview of the brand, as a follower alert.
 *
 * Uses the same `AlertCard` the OBS runtime does, so this is not a mock-up that
 * can drift — change a colour here and you are looking at the real thing.
 *
 * It reads the surrounding form rather than the saved record, so it updates as
 * you type rather than after you commit.
 */

const SAMPLE: NormalizedEvent = {
  type: 'channel.follow',
  provider: 'twitch',
  providerEventId: 'preview',
  occurredAt: new Date(0).toISOString(),
  actor: { id: 'preview', displayName: 'NightOwl_92' },
  data: {},
  isTest: true,
}

export function BrandPreview({ initial, logoUrl }: { initial: BrandDna; logoUrl: string | null }) {
  const [dna, setDna] = useState(initial)
  const [replay, setReplay] = useState(0)

  // Mirror the form's current values rather than the last saved ones.
  useEffect(() => {
    const form = document.getElementById('brand-dna-form')
    if (!(form instanceof HTMLFormElement)) return

    function read() {
      const data = new FormData(form as HTMLFormElement)
      const colour = (key: string, fallback: string) => {
        const entry = data.get(key)
        return typeof entry === 'string' && /^#[0-9a-fA-F]{6}$/.test(entry) ? entry : fallback
      }

      setDna((current) => ({
        ...current,
        colors: {
          primary: colour('primary', current.colors.primary),
          secondary: colour('secondary', current.colors.secondary),
          accent: colour('accent', current.colors.accent),
          background: colour('background', current.colors.background),
          text: colour('text', current.colors.text),
        },
        typography: {
          ...current.typography,
          heading: String(data.get('heading') ?? current.typography.heading),
          body: String(data.get('body') ?? current.typography.body),
        },
      }))
    }

    form.addEventListener('input', read)
    form.addEventListener('change', read)
    return () => {
      form.removeEventListener('input', read)
      form.removeEventListener('change', read)
    }
  }, [])

  return (
    <div className="space-y-3">
      <style dangerouslySetInnerHTML={{ __html: ALERT_ANIMATION_CSS }} />

      <CanvasPreview>
        <AlertCard
          key={replay}
          event={SAMPLE}
          spec={defaultSpecFor('channel.follow')}
          messageTemplate="{{username}}"
          dna={dna}
          logoUrl={logoUrl}
        />
      </CanvasPreview>

      <button
        type="button"
        onClick={() => setReplay((count) => count + 1)}
        className="text-sm font-medium text-accent hover:underline"
      >
        Replay preview
      </button>
    </div>
  )
}
