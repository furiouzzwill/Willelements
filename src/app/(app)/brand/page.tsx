import type { Metadata } from 'next'

import { BrandPreview } from '@/app/(app)/brand/brand-preview'
import { DnaForm, IdentityForm } from '@/app/(app)/brand/brand-forms'
import { PageHeader } from '@/components/shell/page-header'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { getDefaultBrand } from '@/lib/services/brand-service'

export const metadata: Metadata = { title: 'Brand DNA' }

/**
 * Brand Studio.
 *
 * Identity and DNA are separate forms so saving a colour does not require
 * re-submitting the name, and a validation error in one does not discard the
 * other. The preview reads the DNA form live.
 */
export default function BrandPage() {
  const brand = getDefaultBrand()

  if (!brand) {
    return (
      <>
        <PageHeader title="Brand DNA" />
        <Panel>
          <EmptyState
            title="No brand yet"
            description="Something went wrong with first-run setup — a starter brand should have been created automatically."
          />
        </Panel>
      </>
    )
  }

  const logoUrl = brand.logoAssetId ? `/api/assets/${brand.logoAssetId}` : null

  return (
    <>
      <PageHeader
        title="Brand DNA"
        description="Your visual identity. Everything this app generates inherits it."
        action={
          <ButtonLink href="/brand/logos" variant="secondary" size="sm">
            Manage logos
          </ButtonLink>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-5">
          <IdentityForm brand={brand} />
          <DnaForm dna={brand.dna} />
        </div>

        <Panel className="lg:sticky lg:top-8">
          <PanelHeader title="Preview" description="A follower alert in your brand" />
          <div className="px-5 py-5">
            <BrandPreview initial={brand.dna} logoUrl={logoUrl} />
            <p className="mt-4 text-xs text-ink-subtle">
              Colours and fonts update as you edit. The real alert runtime arrives in
              Phase 6 — this shows the styling, not the final motion.
            </p>
          </div>
        </Panel>
      </div>
    </>
  )
}
