import type { Metadata } from 'next'

import { PageHeader } from '@/components/shell/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { displayNameFor, requireUser } from '@/lib/auth/dal'

export const metadata: Metadata = { title: 'Account settings' }

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3.5 last:border-b-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="font-mono text-sm text-ink">{value}</span>
    </div>
  )
}

export default async function SettingsPage() {
  const user = await requireUser()

  return (
    <>
      <PageHeader
        title="Account"
        description="Your platform account. Connected channels are managed separately under Integrations."
      />

      <Panel>
        <PanelHeader title="Profile" />
        <div>
          <Row label="Creator name" value={displayNameFor(user)} />
          <Row label="Email" value={user.email ?? '—'} />
          <Row
            label="Member since"
            value={new Date(user.created_at).toISOString().slice(0, 10)}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Editing"
          description="Profile editing lands with the profiles table in Phase 2"
        />
        <p className="px-5 py-5 text-sm text-ink-muted">
          Right now your creator name lives in Supabase auth metadata. Phase 2 introduces
          the <code className="font-mono text-xs text-ink">profiles</code> table with Row
          Level Security, which is where editable profile and brand data will live.
        </p>
      </Panel>
    </>
  )
}
