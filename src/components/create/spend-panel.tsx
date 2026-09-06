import { formatCost, PRICES_CHECKED_AT } from '@/lib/providers/openai/pricing'
import type { SpendSummary } from '@/lib/services/image-service'
import { Panel, PanelHeader } from '@/components/ui/panel'

/**
 * What you have spent, labelled as the estimate it is.
 *
 * The roadmap asks for a visible spend counter, and the temptation is to print
 * a confident dollar figure. But this number is computed from a published price
 * list read on a date — it knows nothing about your credits, discounts, tax or
 * tier. Presenting it as billed would be inventing a figure no provider gave
 * us, which is the one thing this project treats as a bug rather than a
 * rounding error.
 *
 * So: the word "estimated", the date the prices were read, and a pointer to the
 * authority. Generations whose model publishes no verifiable price are counted
 * separately rather than being quietly treated as free.
 */
export function SpendPanel({ spend }: { spend: SpendSummary }) {
  return (
    <Panel>
      <PanelHeader
        title="Spend"
        description="The only part of this app that costs money"
      />

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface-raised px-4 py-3">
          <p className="font-display text-xs font-medium tracking-wide text-ink-subtle uppercase">
            Estimated total
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
            {formatCost(spend.total)}
          </p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {spend.succeededCount} {spend.succeededCount === 1 ? 'image' : 'images'}
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface-raised px-4 py-3">
          <p className="font-display text-xs font-medium tracking-wide text-ink-subtle uppercase">
            Unpriced
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
            {spend.unpricedCount}
          </p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {spend.unpricedCount === 0
              ? 'Every image had a known price'
              : 'Cost real, but not in the total'}
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface-raised px-4 py-3">
          <p className="font-display text-xs font-medium tracking-wide text-ink-subtle uppercase">
            Failed
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
            {spend.failedCount}
          </p>
          <p className="mt-0.5 text-xs text-ink-subtle">Not charged</p>
        </div>
      </div>

      <p className="border-t border-line px-5 py-3 text-xs text-ink-subtle">
        An <strong className="text-ink-muted">estimate</strong>, from prices published on{' '}
        {PRICES_CHECKED_AT}. It cannot see your credits, discounts or tax, so what you are
        actually billed is whatever OpenAI&apos;s usage dashboard says. A failed generation is
        not charged and is not counted here.
        {spend.unpricedCount > 0 ? (
          <>
            {' '}
            {spend.unpricedCount}{' '}
            {spend.unpricedCount === 1 ? 'image was' : 'images were'} made with a model whose
            price is not published in a form this app could verify, so{' '}
            {spend.unpricedCount === 1 ? 'it is' : 'they are'} missing from the total rather
            than guessed at.
          </>
        ) : null}
      </p>
    </Panel>
  )
}
