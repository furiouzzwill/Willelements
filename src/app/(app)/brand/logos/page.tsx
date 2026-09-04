import type { Metadata } from 'next'

import { choosePrimaryLogo, removeAsset } from '@/app/(app)/brand/actions'
import { UploadForm } from '@/app/(app)/brand/logos/upload-form'
import { PageHeader } from '@/components/shell/page-header'
import { Checkerboard } from '@/components/ui/checkerboard'
import { Button } from '@/components/ui/button'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { listAssets } from '@/lib/services/asset-service'
import { getDefaultBrand } from '@/lib/services/brand-service'

export const metadata: Metadata = { title: 'Logos' }

export default function LogosPage() {
  const brand = getDefaultBrand()
  const logos = listAssets('logo')

  return (
    <>
      <PageHeader
        title="Logos"
        description="Upload your logo and choose which one your overlays use."
      />

      <Panel>
        <PanelHeader title="Upload" />
        <div className="px-5 py-5">
          <UploadForm />
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Your logos"
          description={logos.length === 1 ? '1 logo' : `${logos.length} logos`}
        />

        {logos.length === 0 ? (
          <EmptyState
            title="No logos yet"
            description="Upload one above. It becomes your brand's logo automatically, and appears in the Brand DNA preview."
          />
        ) : (
          <ul className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
            {logos.map((logo) => {
              const isPrimary = brand?.logoAssetId === logo.id

              return (
                <li
                  key={logo.id}
                  className="space-y-3 rounded-lg border border-line bg-surface-raised p-3"
                >
                  <Checkerboard className="grid aspect-square place-items-center p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local asset route */}
                    <img
                      src={`/api/assets/${logo.id}`}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  </Checkerboard>

                  <div className="flex items-center justify-between gap-2">
                    {isPrimary ? (
                      <span className="rounded-full bg-accent-soft/60 px-2.5 py-1 text-xs font-medium text-ink">
                        In use
                      </span>
                    ) : (
                      <form action={choosePrimaryLogo}>
                        <input type="hidden" name="assetId" value={logo.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          Use this
                        </Button>
                      </form>
                    )}

                    <form action={removeAsset}>
                      <input type="hidden" name="assetId" value={logo.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Delete
                      </Button>
                    </form>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </>
  )
}
