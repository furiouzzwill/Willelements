import type { Metadata } from 'next'
import Link from 'next/link'

import { generateOne } from '@/app/(app)/create/actions'
import { GenerateForm } from '@/components/create/generate-form'
import { SpendPanel } from '@/components/create/spend-panel'
import { PageHeader } from '@/components/shell/page-header'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { formatCost } from '@/lib/providers/openai/pricing'
import { getDefaultBrand } from '@/lib/services/brand-service'
import { hasApiKey, listGeneratedImages, spendSummary } from '@/lib/services/image-service'
import { SUBJECTS } from '@/lib/services/image-prompt'

export const metadata: Metadata = { title: 'AI Create' }

/**
 * Generating artwork from the Brand DNA.
 *
 * The key check comes first and is stated plainly, the same way the animations
 * page handles a missing FFmpeg. A Generate button that fails on press because
 * of configuration is the pattern this project keeps deliberately avoiding.
 */
export default function CreatePage() {
  const brand = getDefaultBrand()
  const keyPresent = hasApiKey()
  const spend = spendSummary()
  const recent = listGeneratedImages(12)

  return (
    <>
      <PageHeader
        title="AI Create"
        description="Artwork generated from your Brand DNA."
        action={
          <ButtonLink href="/create/packages" variant="secondary" size="sm">
            Stream package
          </ButtonLink>
        }
      />

      {!keyPresent ? (
        <Panel>
          <PanelHeader title="No API key" />
          <div className="space-y-3 px-5 py-5 text-sm">
            <p className="text-ink-muted">
              This is the only part of Willelements that costs money, so it needs your own
              OpenAI key. Nothing here runs without one, and nothing is spent until you press
              Generate.
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-ink-subtle">
              <li>
                Create a key at{' '}
                <span className="text-ink-muted">platform.openai.com/api-keys</span>
              </li>
              <li>
                Add <code className="text-ink-muted">OPENAI_API_KEY=sk-…</code> to{' '}
                <code className="text-ink-muted">.env.local</code>
              </li>
              <li>Restart the app — env files are only read at startup</li>
            </ol>
          </div>
        </Panel>
      ) : null}

      {!brand ? (
        <Panel>
          <PanelHeader title="No brand" />
          <EmptyState
            title="Nothing to generate from"
            description="Every prompt is built from your Brand DNA — colours, style and rules. Set that up first."
            action={
              <ButtonLink href="/brand" size="sm">
                Open Brand Studio
              </ButtonLink>
            }
          />
        </Panel>
      ) : (
        <>
          <SpendPanel spend={spend} />

          {SUBJECTS.map((subject) => (
            <Panel key={subject.id}>
              <PanelHeader
                title={subject.label}
                description={`${subject.description} · ${subject.size}`}
              />
              <GenerateForm
                action={generateOne}
                subjectId={subject.id}
                sizes={[subject.size]}
                disabled={!keyPresent}
              />
            </Panel>
          ))}

          <Panel>
            <PanelHeader
              title="Generated"
              description={
                recent.length > 0 ? 'Newest first' : 'Nothing generated yet'
              }
            />
            {recent.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-subtle">
                Anything you generate lands here and in your asset library, with the prompt,
                model and estimated cost recorded beside it.
              </p>
            ) : (
              <ul className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
                {recent.map((generation) => (
                  <li
                    key={generation.id}
                    className="overflow-hidden rounded-lg border border-line bg-surface-raised"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/assets/${generation.assetId}`}
                      alt={generation.subject}
                      className="aspect-square w-full bg-canvas object-contain"
                      loading="lazy"
                    />
                    <div className="space-y-1 px-3 py-2">
                      <p className="text-sm text-ink">{generation.subject}</p>
                      <p className="text-xs text-ink-subtle">
                        {generation.model} · {generation.quality} ·{' '}
                        <span className="tabular-nums">
                          {formatCost(generation.costEstimate)}
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-line px-5 py-3 text-xs text-ink-subtle">
              Everything generated is also in your{' '}
              <Link href="/brand/assets" className="text-accent hover:underline">
                asset library
              </Link>
              .
            </p>
          </Panel>
        </>
      )}
    </>
  )
}
