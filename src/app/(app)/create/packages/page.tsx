import type { Metadata } from 'next'

import { generateStreamPackage } from '@/app/(app)/create/actions'
import { GenerateForm } from '@/components/create/generate-form'
import { SpendPanel } from '@/components/create/spend-panel'
import { PageHeader } from '@/components/shell/page-header'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { getDefaultBrand } from '@/lib/services/brand-service'
import { hasApiKey, spendSummary } from '@/lib/services/image-service'
import { findSubject, PACKAGE_SUBJECT_IDS } from '@/lib/services/image-prompt'

export const metadata: Metadata = { title: 'Stream packages' }

/**
 * The whole set, from one brand, in one press.
 *
 * The cost shown is for all four together, because that is what the button
 * buys. Quoting a per-image price next to a control that makes four would be
 * technically true and practically misleading.
 */
export default function PackagesPage() {
  const brand = getDefaultBrand()
  const keyPresent = hasApiKey()
  const spend = spendSummary()

  const subjects = PACKAGE_SUBJECT_IDS.map((id) => findSubject(id)).filter(
    (subject) => subject !== null,
  )

  return (
    <>
      <PageHeader
        title="Stream package"
        description="A logo, a background, a panel and an offline card — one brand, one press."
        action={
          <ButtonLink href="/create" variant="secondary" size="sm">
            Generate one at a time
          </ButtonLink>
        }
      />

      {!brand ? (
        <Panel>
          <PanelHeader title="No brand" />
          <EmptyState
            title="Nothing to generate from"
            description="A package is built entirely from your Brand DNA. Set that up first."
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

          <Panel>
            <PanelHeader title="What you get" description="Four pieces, in this order" />
            <ol className="divide-y divide-line">
              {subjects.map((subject, index) => (
                <li key={subject.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="w-4 shrink-0 text-xs tabular-nums text-ink-subtle">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{subject.label}</span>
                    <span className="block text-xs text-ink-subtle">
                      {subject.description} · {subject.size}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="border-t border-line px-5 py-3 text-xs text-ink-subtle">
              Generated one after another rather than all at once. If the provider refuses or
              rate-limits partway, it stops there — so a failure costs you what was made up to
              that point and no more.
            </p>
          </Panel>

          <Panel>
            <PanelHeader
              title="Generate the package"
              description="The estimate below covers all four"
            />
            <GenerateForm
              action={generateStreamPackage}
              sizes={subjects.map((subject) => subject.size)}
              label="Generate package"
              disabled={!keyPresent}
            />
            {!keyPresent ? (
              <p className="border-t border-line px-5 py-3 text-xs text-ink-subtle">
                Add <code className="text-ink-muted">OPENAI_API_KEY</code> to{' '}
                <code className="text-ink-muted">.env.local</code> and restart. Nothing is
                spent until you press Generate.
              </p>
            ) : null}
          </Panel>
        </>
      )}
    </>
  )
}
