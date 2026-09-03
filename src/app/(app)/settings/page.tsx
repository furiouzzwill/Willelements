import type { Metadata } from 'next'
import path from 'node:path'

import { PageHeader } from '@/components/shell/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { DATA_DIR } from '@/lib/db'
import { LATEST_VERSION } from '@/lib/db/migrations'
import { siteUrl } from '@/lib/env'
import { getStorageStats } from '@/lib/services/setup-service'

export const metadata: Metadata = { title: 'Settings' }

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3.5 last:border-b-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="font-mono text-xs break-all text-ink">{value}</span>
    </div>
  )
}

export default function SettingsPage() {
  const stats = getStorageStats()

  return (
    <>
      <PageHeader
        title="Settings"
        description="This app runs entirely on this machine. Nothing is uploaded anywhere."
      />

      <Panel>
        <PanelHeader
          title="Storage"
          description="Back up by copying this one folder"
        />
        <div>
          <Row label="Data directory" value={DATA_DIR} />
          <Row label="Database" value={path.join(DATA_DIR, 'app.db')} />
          <Row label="Assets" value={path.join(DATA_DIR, 'assets')} />
          <Row label="Schema version" value={String(LATEST_VERSION)} />
          <Row label="Database size" value={stats.databaseSize} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Contents" />
        <div>
          <Row label="Brands" value={String(stats.brands)} />
          <Row label="Assets" value={String(stats.assets)} />
          <Row label="Overlays" value={String(stats.overlays)} />
          <Row label="Alert configs" value={String(stats.alertConfigs)} />
          <Row label="Stream events" value={String(stats.streamEvents)} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Application" />
        <div>
          <Row label="App URL" value={siteUrl()} />
          <Row label="Overlay URLs" value={`${siteUrl()}/overlay/{token}`} />
        </div>
        <p className="border-t border-line px-5 py-4 text-sm text-ink-muted">
          Overlay browser sources become available in Phase 5. They use opaque, rotatable
          tokens so a URL left visible on stream can be revoked without disturbing
          anything else.
        </p>
      </Panel>
    </>
  )
}
