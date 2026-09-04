import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { AlertLayer } from '@/app/overlay/[token]/alert-layer'
import { defaultBrandDna } from '@/lib/schemas/brand'
import { getOverlayAlertConfigs } from '@/lib/services/alert-service'
import { getDefaultBrand } from '@/lib/services/brand-service'
import { getOverlayByToken } from '@/lib/services/overlay-service'
import { buildWidgetData } from '@/lib/services/widget-data-service'
import { listWidgets } from '@/lib/services/widget-service'

/**
 * The page an OBS browser source loads.
 *
 * Everything it needs — brand colours, fonts, the logo — is resolved here and
 * passed down, so an alert costs one render and no network request. The only
 * connection this page opens is the event stream.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Overlay',
  // Nothing about a browser source should ever be indexed or previewed.
  robots: { index: false, follow: false },
}

export default async function OverlayPage({ params }: PageProps<'/overlay/[token]'>) {
  const { token } = await params
  const overlay = getOverlayByToken(token)

  // An unknown or rotated token is indistinguishable from a wrong one, on
  // purpose — there is nothing here to tell an unwanted visitor.
  if (!overlay) notFound()

  const brand = getDefaultBrand()
  const dna = brand?.dna ?? defaultBrandDna()
  const logoUrl = brand?.logoAssetId ? `/api/assets/${brand.logoAssetId}` : null

  return (
    <AlertLayer
      token={token}
      dna={dna}
      logoUrl={logoUrl}
      configs={getOverlayAlertConfigs()}
      widgets={listWidgets(overlay.id)}
      canvasWidth={overlay.canvasWidth}
      canvasHeight={overlay.canvasHeight}
      initialWidgetData={await buildWidgetData()}
    />
  )
}
