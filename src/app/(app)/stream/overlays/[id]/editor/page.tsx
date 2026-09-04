import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { EditorShell } from '@/app/(app)/stream/overlays/[id]/editor/editor-shell'
import { PageHeader } from '@/components/shell/page-header'
import { ButtonLink } from '@/components/ui/button'
import { defaultBrandDna } from '@/lib/schemas/brand'
import { listAssets } from '@/lib/services/asset-service'
import { getDefaultBrand } from '@/lib/services/brand-service'
import { getOverlay } from '@/lib/services/overlay-service'
import { listWidgets } from '@/lib/services/widget-service'
import { buildWidgetData } from '@/lib/services/widget-data-service'

export const metadata: Metadata = { title: 'Overlay editor' }

export default async function OverlayEditorPage({
  params,
}: PageProps<'/stream/overlays/[id]/editor'>) {
  const { id } = await params
  const overlay = getOverlay(id)
  if (!overlay) notFound()

  const brand = getDefaultBrand()

  return (
    <>
      <PageHeader
        title={`Editing ${overlay.name}`}
        description={`${overlay.canvasWidth} × ${overlay.canvasHeight} — drag to move, corners to resize`}
        action={
          <ButtonLink href={`/stream/overlays/${overlay.id}`} variant="secondary" size="sm">
            Done
          </ButtonLink>
        }
      />

      <EditorShell
        overlayId={overlay.id}
        widgets={listWidgets(overlay.id)}
        canvasWidth={overlay.canvasWidth}
        canvasHeight={overlay.canvasHeight}
        dna={brand?.dna ?? defaultBrandDna()}
        logoUrl={brand?.logoAssetId ? `/api/assets/${brand.logoAssetId}` : null}
        assets={listAssets()
          .filter((asset) => asset.mimeType.startsWith('image/'))
          .map((asset) => ({ id: asset.id, type: asset.type }))}
        // Real values where they exist, so the editor is not full of dashes.
        previewData={await buildWidgetData()}
      />
    </>
  )
}
