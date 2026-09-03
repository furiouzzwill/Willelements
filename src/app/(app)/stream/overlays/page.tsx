import Link from 'next/link'
import type { Metadata } from 'next'

import { CreateOverlayForm } from '@/app/(app)/stream/overlays/create-form'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { listOverlays } from '@/lib/services/overlay-service'

export const metadata: Metadata = { title: 'Overlays' }

export default function OverlaysPage() {
  const overlays = listOverlays()

  return (
    <>
      <PageHeader
        title="Overlays"
        description="Each overlay is a browser source you add to OBS."
      />

      <Panel>
        <PanelHeader
          title="Your overlays"
          description={overlays.length === 1 ? '1 overlay' : `${overlays.length} overlays`}
        />

        {overlays.length === 0 ? (
          <EmptyState
            title="No overlays yet"
            description="Create one below, then paste its URL into an OBS browser source."
          />
        ) : (
          <ul>
            {overlays.map((overlay) => (
              <li key={overlay.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/stream/overlays/${overlay.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-raised"
                >
                  <div>
                    <p className="font-display text-sm font-medium text-ink">{overlay.name}</p>
                    <p className="text-xs text-ink-subtle">
                      {overlay.canvasWidth} × {overlay.canvasHeight}
                    </p>
                  </div>
                  <span aria-hidden="true" className="text-ink-subtle">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="New overlay" />
        <div className="px-5 py-5">
          <CreateOverlayForm />
        </div>
      </Panel>
    </>
  )
}
