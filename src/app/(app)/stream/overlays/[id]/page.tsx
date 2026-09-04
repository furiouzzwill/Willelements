import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import {
  deleteOverlayAction,
  renameOverlayAction,
  rotateTokenAction,
} from '@/app/(app)/stream/overlays/actions'
import {
  CopyUrl,
  OverlayPreview,
  TestAlerts,
} from '@/app/(app)/stream/overlays/[id]/overlay-tools'
import { PageHeader } from '@/components/shell/page-header'
import { Button, ButtonLink } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/field'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { browserSourceUrl, getOverlay } from '@/lib/services/overlay-service'

export const metadata: Metadata = { title: 'Overlay' }

export default async function OverlayDetailPage({
  params,
}: PageProps<'/stream/overlays/[id]'>) {
  const { id } = await params
  const overlay = getOverlay(id)
  if (!overlay) notFound()

  const url = browserSourceUrl(overlay)

  return (
    <>
      <PageHeader
        title={overlay.name}
        description={`${overlay.canvasWidth} × ${overlay.canvasHeight} browser source`}
        action={
          <div className="flex gap-2">
            <ButtonLink href="/stream/overlays" variant="ghost" size="sm">
              All overlays
            </ButtonLink>
            <ButtonLink href={`/stream/overlays/${overlay.id}/editor`} size="sm">
              Edit layout
            </ButtonLink>
          </div>
        }
      />

      <Panel>
        <PanelHeader
          title="Browser source URL"
          description="Paste this into OBS"
        />
        <div className="space-y-4 px-5 py-5">
          <CopyUrl url={url} />

          <ol className="space-y-1.5 text-sm text-ink-muted">
            <li>
              <span className="text-ink">1.</span> In OBS: Sources → + → Browser
            </li>
            <li>
              <span className="text-ink">2.</span> Paste the URL, set Width{' '}
              {overlay.canvasWidth} and Height {overlay.canvasHeight}
            </li>
            <li>
              <span className="text-ink">3.</span> Leave &ldquo;Shutdown source when not
              visible&rdquo; unchecked, so the overlay keeps its connection when you switch
              scenes
            </li>
          </ol>

          <p className="text-sm text-ink-subtle">
            This URL is an opaque token — it carries no account details and grants no
            access to anything but this overlay&rsquo;s event stream.
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Test alerts"
          description="Sent through the real pipeline, not a mock"
        />
        <div className="space-y-4 px-5 py-5">
          <TestAlerts overlayId={overlay.id} />
          <p className="text-sm text-ink-subtle">
            Alerts queue rather than overlap — press several quickly and they play in
            order.
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Preview"
          description="The same page OBS loads, over a stand-in for your gameplay"
        />
        <div className="px-5 py-5">
          <OverlayPreview
            url={url}
            width={overlay.canvasWidth}
            height={overlay.canvasHeight}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Settings" />

        <form action={renameOverlayAction} className="space-y-3 border-b border-line px-5 py-5">
          <input type="hidden" name="overlayId" value={overlay.id} />
          <Label htmlFor="overlay-name">Name</Label>
          <div className="flex gap-2">
            <Input id="overlay-name" name="name" defaultValue={overlay.name} required />
            <Button type="submit" variant="secondary" size="sm">
              Rename
            </Button>
          </div>
        </form>

        <form action={rotateTokenAction} className="space-y-3 border-b border-line px-5 py-5">
          <input type="hidden" name="overlayId" value={overlay.id} />
          <p className="text-sm font-medium text-ink">Rotate URL</p>
          <p className="text-sm text-ink-muted">
            Generates a new token and <span className="text-ink">breaks the current URL
            immediately</span>. Use this if the URL was visible on stream — then paste the
            new one into OBS.
          </p>
          <Button type="submit" variant="secondary" size="sm">
            Rotate URL
          </Button>
        </form>

        <form action={deleteOverlayAction} className="space-y-3 px-5 py-5">
          <input type="hidden" name="overlayId" value={overlay.id} />
          <p className="text-sm font-medium text-ink">Delete overlay</p>
          <p className="text-sm text-ink-muted">
            Removes the overlay and its widgets. The OBS source will show nothing.
          </p>
          <Button type="submit" variant="ghost" size="sm">
            Delete
          </Button>
        </form>
      </Panel>
    </>
  )
}
