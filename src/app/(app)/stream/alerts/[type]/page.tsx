import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { AlertEditor } from '@/app/(app)/stream/alerts/[type]/alert-editor'
import { PageHeader } from '@/components/shell/page-header'
import { ButtonLink } from '@/components/ui/button'
import { defaultBrandDna } from '@/lib/schemas/brand'
import { EVENT_LABELS, EVENT_TYPES, type EventType } from '@/lib/schemas/event'
import { getAlertConfig } from '@/lib/services/alert-service'
import { getDefaultBrand } from '@/lib/services/brand-service'
import { buildTestEvent } from '@/lib/services/test-event-service'

export const metadata: Metadata = { title: 'Alert' }

export default async function AlertEditorPage({ params }: PageProps<'/stream/alerts/[type]'>) {
  const { type } = await params
  const decoded = decodeURIComponent(type)

  if (!EVENT_TYPES.includes(decoded as EventType)) notFound()
  const eventType = decoded as EventType

  const config = getAlertConfig(eventType)
  const brand = getDefaultBrand()
  const dna = brand?.dna ?? defaultBrandDna()

  return (
    <>
      <PageHeader
        title={EVENT_LABELS[eventType]}
        description="Configure what plays, then test it in your overlay."
        action={
          <ButtonLink href="/stream/alerts" variant="ghost" size="sm">
            All alerts
          </ButtonLink>
        }
      />

      <AlertEditor
        eventType={eventType}
        initial={{
          spec: config.spec,
          messageTemplate: config.messageTemplate,
          durationMs: config.durationMs,
          minThreshold: config.minThreshold,
          enabled: config.enabled,
        }}
        dna={dna}
        logoUrl={brand?.logoAssetId ? `/api/assets/${brand.logoAssetId}` : null}
        // The same builder the Test Alert button uses, so the preview shows a
        // realistic name and realistic values for this event type.
        sampleEvent={buildTestEvent(eventType)}
        soundUrl={config.soundAssetId ? `/api/assets/${config.soundAssetId}` : null}
      />
    </>
  )
}
