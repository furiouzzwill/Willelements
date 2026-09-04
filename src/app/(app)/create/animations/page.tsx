import Link from 'next/link'
import type { Metadata } from 'next'

import { RenderPanel, type TemplateSummary } from '@/app/(app)/create/animations/render-panel'
import { RenderQueue } from '@/app/(app)/create/animations/render-queue'
import { ToolchainPanel } from '@/app/(app)/create/animations/toolchain-panel'
import { PageHeader } from '@/components/shell/page-header'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { toVisualIdentity } from '@/lib/hyperframes/identity'
import { COMPOSITION_TEMPLATES } from '@/lib/hyperframes/templates'
import { cachedToolchain, isProbingToolchain } from '@/lib/hyperframes/toolchain'
import { getDefaultBrand } from '@/lib/services/brand-service'
import { listRenderJobs, summarizeRenderJob } from '@/lib/services/render-service'
import { getChannelState } from '@/lib/services/twitch-service'

export const metadata: Metadata = { title: 'Animations' }

export default async function AnimationsPage() {
  const brand = getDefaultBrand()
  const toolchain = cachedToolchain()
  const probing = isProbingToolchain()
  const jobs = listRenderJobs().map(summarizeRenderJob)

  if (!brand) {
    return (
      <>
        <PageHeader title="Animations" description="Motion graphics rendered from your brand." />
        <Panel>
          <EmptyState
            title="Set up a brand first"
            description="Every composition is built from your Brand DNA — its colours, type, and how its motion should feel. There is nothing to render until that exists."
            action={<ButtonLink href="/brand">Open Brand Studio</ButtonLink>}
          />
        </Panel>
      </>
    )
  }

  const identity = toVisualIdentity(brand.dna)

  const templates: TemplateSummary[] = COMPOSITION_TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
    summary: template.summary,
    usage: template.usage,
    width: template.width,
    height: template.height,
    format: template.format,
    loops: template.loops,
    usesLogo: template.usesLogo,
    durationSeconds: template.duration(identity),
    headline: template.headline,
    subhead: template.subhead,
    defaults: template.defaults(brand.name),
  }))

  // Only asks Twitch when an account is actually connected — otherwise this
  // returns immediately without a request.
  const channel = await getChannelState()
  const isLive = channel.status === 'ok' && channel.live.isLive

  const canRender = toolchain?.ready === true
  const blockedReason = canRender
    ? null
    : toolchain === null
      ? probing
        ? 'Checking whether this machine can render. This is the first run, so it may be fetching the renderer.'
        : 'Check the render toolchain below before rendering.'
      : 'This machine is missing something the renderer needs — see the panel below.'

  return (
    <>
      <PageHeader
        title="Animations"
        description="Motion graphics rendered from your Brand DNA, as video files for OBS."
        action={
          <ButtonLink href="/brand" variant="secondary" size="sm">
            Edit Brand DNA
          </ButtonLink>
        }
      />

      {isLive ? (
        <p
          role="status"
          className="rounded-xl border border-live/40 bg-live/10 px-4 py-3 text-sm text-ink"
        >
          You are live right now. A render uses every core it can get, on the same machine
          that is encoding your stream — it is worth waiting until you are off air.
        </p>
      ) : null}

      <Panel>
        <PanelHeader
          title="Render a composition"
          description={`Built from ${brand.name} — ${identity.motion.duration.base}s beats, ${identity.type.transform === 'uppercase' ? 'uppercase' : 'sentence case'} headings`}
        />
        <RenderPanel
          templates={templates}
          hasLogo={Boolean(brand.logoAssetId)}
          canRender={canRender}
          blockedReason={blockedReason}
        />
      </Panel>

      <Panel>
        <PanelHeader
          title="Renders"
          description="Finished files are saved to your asset library"
        />
        <RenderQueue initialJobs={jobs} />
      </Panel>

      <Panel>
        <PanelHeader title="Render toolchain" description="What this machine can do" />
        <ToolchainPanel status={toolchain} probing={probing} />
      </Panel>

      <Panel>
        <PanelHeader title="How this fits with alerts" />
        <ul className="space-y-2.5 px-5 py-5 text-sm text-ink-muted">
          <li>
            These are <strong className="text-ink">rendered assets</strong> — files you add
            to an OBS scene as a media source. A logo sting, a holding card, a name bar.
          </li>
          <li>
            <Link href="/stream/alerts" className="text-accent hover:underline">
              Alerts
            </Link>{' '}
            are the opposite: they play live in the browser source, per event, in
            milliseconds. Nothing about a follow or a raid is ever pre-rendered — putting a
            live event through a render job would make it slow, expensive and fragile.
          </li>
          <li>
            Compositions are plain HTML. Each render keeps the file that produced it under{' '}
            <code>data/renders</code>, so a result you did not expect can be opened and read.
          </li>
        </ul>
      </Panel>
    </>
  )
}
