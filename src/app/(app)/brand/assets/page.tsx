import type { Metadata } from 'next'

import { removeAsset } from '@/app/(app)/brand/actions'
import { PageHeader } from '@/components/shell/page-header'
import { Button, ButtonLink } from '@/components/ui/button'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { listAssets } from '@/lib/services/asset-service'

export const metadata: Metadata = { title: 'Asset Library' }

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AssetLibraryPage() {
  const assets = listAssets()

  const images = assets.filter((asset) => asset.mimeType.startsWith('image/'))
  const others = assets.filter((asset) => !asset.mimeType.startsWith('image/'))

  return (
    <>
      <PageHeader
        title="Asset Library"
        description="Everything you have uploaded or generated. Stored in your data folder."
        action={
          <ButtonLink href="/brand/logos" variant="secondary" size="sm">
            Upload a logo
          </ButtonLink>
        }
      />

      {assets.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nothing here yet"
            description="Uploaded logos appear here, and so will everything generated in later phases."
          />
        </Panel>
      ) : null}

      {images.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Images"
            description={images.length === 1 ? '1 file' : `${images.length} files`}
          />
          <ul className="grid gap-4 px-5 py-5 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((asset) => (
              <li
                key={asset.id}
                className="space-y-2 rounded-lg border border-line bg-surface-raised p-2.5"
              >
                <div className="grid aspect-square place-items-center overflow-hidden rounded-md bg-canvas p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local asset route */}
                  <img
                    src={`/api/assets/${asset.id}`}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="space-y-0.5">
                  <p className="truncate text-xs font-medium text-ink capitalize">
                    {asset.type}
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {asset.mimeType.replace('image/', '').toUpperCase()} ·{' '}
                    {formatBytes(asset.fileSize)}
                  </p>
                </div>
                <form action={removeAsset}>
                  <input type="hidden" name="assetId" value={asset.id} />
                  <Button type="submit" variant="ghost" size="sm" className="w-full">
                    Delete
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {others.length > 0 ? (
        <Panel>
          <PanelHeader title="Other files" />
          <ul>
            {others.map((asset) => (
              <li
                key={asset.id}
                className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-b-0"
              >
                <div>
                  <p className="text-sm text-ink capitalize">{asset.type}</p>
                  <p className="text-xs text-ink-subtle">
                    {asset.mimeType} · {formatBytes(asset.fileSize)}
                  </p>
                </div>
                <form action={removeAsset}>
                  <input type="hidden" name="assetId" value={asset.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Delete
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  )
}
