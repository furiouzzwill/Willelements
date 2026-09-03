import type { Metadata } from 'next'

import { PageHeader } from '@/components/shell/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { requireUser } from '@/lib/auth/dal'

export const metadata: Metadata = { title: 'Security' }

export default async function SecurityPage() {
  const user = await requireUser()
  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
    : 'Unknown'

  return (
    <>
      <PageHeader title="Security" description="How your account is protected." />

      <Panel>
        <PanelHeader title="Session" />
        <div className="space-y-3 px-5 py-5 text-sm text-ink-muted">
          <p>
            Last sign-in: <span className="font-mono text-ink">{lastSignIn}</span>
          </p>
          <p>
            Email confirmed:{' '}
            <span className="font-mono text-ink">
              {user.email_confirmed_at ? 'yes' : 'no'}
            </span>
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="How your data is protected" />
        <ul className="space-y-3 px-5 py-5 text-sm text-ink-muted">
          <li>
            Sessions are stored in HTTP-only cookies and refreshed on every request. Access
            tokens are verified by signature, never trusted from storage alone.
          </li>
          <li>
            Every protected page resolves your identity server-side; the redirect you see
            when signed out is a convenience, not the security boundary.
          </li>
          <li>
            Provider OAuth tokens will be held server-side only and are never sent to the
            browser or embedded in OBS browser-source URLs.
          </li>
        </ul>
      </Panel>
    </>
  )
}
