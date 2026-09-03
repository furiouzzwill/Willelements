import type { Metadata } from 'next'

import { disconnectTwitch } from '@/app/(app)/integrations/twitch/actions'
import { PageHeader } from '@/components/shell/page-header'
import { Button, ButtonLink } from '@/components/ui/button'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { isTwitchConfigured } from '@/lib/env'
import { TWITCH_SCOPES } from '@/lib/providers/twitch/api'
import { twitchRedirectUri } from '@/lib/providers/twitch/config'
import { getAccount } from '@/lib/services/connected-account-service'
import { getChannelState } from '@/lib/services/twitch-service'

export const metadata: Metadata = { title: 'Twitch' }

const ERRORS: Record<string, string> = {
  not_configured: 'Add your Twitch credentials first — see the setup steps below.',
  denied: 'You cancelled the Twitch authorisation.',
  bad_state:
    'That sign-in could not be verified, so it was rejected. Start the connection again from this page.',
  no_code: 'Twitch did not return an authorisation code. Try again.',
  exchange_failed:
    'Twitch would not complete the connection. Check that the redirect URL below matches your app exactly.',
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3.5 last:border-b-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="font-mono text-xs break-all text-ink">{value}</span>
    </div>
  )
}

function SetupInstructions() {
  return (
    <Panel>
      <PanelHeader
        title="Set up Twitch"
        description="Free, and takes about two minutes"
      />
      <ol className="space-y-4 px-5 py-5 text-sm text-ink-muted">
        <li>
          <span className="font-medium text-ink">1.</span> Go to{' '}
          <a
            href="https://dev.twitch.tv/console/apps/create"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            dev.twitch.tv/console
          </a>{' '}
          and register a new application.
        </li>
        <li>
          <span className="font-medium text-ink">2.</span> Set the OAuth Redirect URL to
          exactly this — Twitch matches it character for character:
          <code className="mt-1.5 block rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink">
            {twitchRedirectUri()}
          </code>
        </li>
        <li>
          <span className="font-medium text-ink">3.</span> Category can be anything;
          &ldquo;Broadcasting Suite&rdquo; fits. Client Type:{' '}
          <span className="text-ink">Confidential</span>.
        </li>
        <li>
          <span className="font-medium text-ink">4.</span> Copy the Client ID, generate a
          Client Secret, and put both in{' '}
          <code className="font-mono text-xs text-ink">.env.local</code>:
          <code className="mt-1.5 block rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-xs whitespace-pre text-ink">
            {'TWITCH_CLIENT_ID=...\nTWITCH_CLIENT_SECRET=...'}
          </code>
        </li>
        <li>
          <span className="font-medium text-ink">5.</span> Restart the app. The Connect
          button appears here.
        </li>
      </ol>
    </Panel>
  )
}

export default async function TwitchIntegrationPage({
  searchParams,
}: PageProps<'/integrations/twitch'>) {
  const params = await searchParams
  const configured = isTwitchConfigured()
  const account = getAccount('twitch')
  const state = account ? await getChannelState() : null

  const errorKey = typeof params.error === 'string' ? params.error : null
  const errorMessage = errorKey ? (ERRORS[errorKey] ?? 'Something went wrong.') : null
  const justConnected = params.connected === '1'

  return (
    <>
      <PageHeader
        title="Twitch"
        description="Connect your channel so alerts and the dashboard have real data."
      />

      {errorMessage ? (
        <p role="alert" className="rounded-lg bg-live/10 px-4 py-3 text-sm text-live">
          {errorMessage}
        </p>
      ) : null}

      {justConnected && !errorMessage ? (
        <p role="status" className="rounded-lg bg-positive/10 px-4 py-3 text-sm text-positive">
          Twitch connected.
        </p>
      ) : null}

      <Panel>
        <PanelHeader title="Connection" />

        {!account ? (
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm text-ink-muted">
              {configured
                ? 'Not connected yet. Twitch will ask you to authorise this app, then send you back here.'
                : 'Add your Twitch application credentials to enable this.'}
            </p>

            {configured ? (
              <ButtonLink href="/api/twitch/connect" prefetch={false}>
                Connect Twitch
              </ButtonLink>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              {account.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote avatar, fixed size
                <img
                  src={account.avatarUrl}
                  alt=""
                  className="size-10 rounded-full border border-line"
                />
              ) : null}
              <div className="min-w-0">
                <p className="font-display text-sm font-medium text-ink">
                  {account.displayName ?? account.username}
                </p>
                <p className="text-xs text-ink-subtle">
                  twitch.tv/{account.username} · connected{' '}
                  {account.connectedAt.slice(0, 10)}
                </p>
              </div>
            </div>

            {state?.status === 'needs_reconnect' || state?.status === 'unavailable' ? (
              <p className="border-b border-line px-5 py-3 text-sm text-warning">
                {state.message}
              </p>
            ) : null}

            {state?.status === 'ok' ? (
              <div>
                <Row
                  label="Status"
                  value={state.live.isLive ? `Live · ${state.live.viewerCount} viewers` : 'Offline'}
                />
                <Row label="Followers" value={state.followerCount.toLocaleString()} />
                {state.channelGame ? <Row label="Category" value={state.channelGame} /> : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
              <form action={disconnectTwitch}>
                <Button type="submit" variant="secondary" size="sm">
                  Disconnect
                </Button>
              </form>
              <ButtonLink href="/api/twitch/connect" variant="ghost" size="sm" prefetch={false}>
                Reconnect
              </ButtonLink>
            </div>
          </>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Permissions"
          description="The minimum needed — nothing is requested speculatively"
        />
        <div className="space-y-3 px-5 py-5">
          <ul className="space-y-2">
            {TWITCH_SCOPES.map((scope) => (
              <li key={scope} className="flex flex-wrap items-baseline gap-2 text-sm">
                <code className="font-mono text-xs text-ink">{scope}</code>
                <span className="text-ink-subtle">
                  your follower count, and follow events for alerts
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-subtle">
            Tokens are encrypted before they are stored and never leave this machine.
            Subscription and cheer permissions are requested later, when the features that
            need them exist.
          </p>
        </div>
      </Panel>

      {!configured ? <SetupInstructions /> : null}
    </>
  )
}
