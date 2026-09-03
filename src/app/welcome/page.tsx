import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { WelcomeForm } from '@/app/welcome/welcome-form'
import { Wordmark } from '@/components/ui/icon'
import { getDefaultBrand } from '@/lib/services/brand-service'
import { needsOnboarding } from '@/lib/services/setup-service'

export const metadata: Metadata = { title: 'Welcome' }
export const dynamic = 'force-dynamic'

export default function WelcomePage() {
  // Nothing to do here once a brand has been named.
  if (!needsOnboarding()) redirect('/dashboard')

  const brand = getDefaultBrand()

  return (
    <div className="aurora flex min-h-dvh flex-col">
      <header className="px-6 py-6">
        <Wordmark />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              Let&rsquo;s set up your brand
            </h1>
            <p className="text-ink-muted">
              Three quick things. Everything you make — overlays, alerts, graphics — will
              be built from this.
            </p>
          </div>

          <WelcomeForm
            defaults={{
              primary: brand?.dna.colors.primary ?? '#A855F7',
              background: brand?.dna.colors.background ?? '#09090B',
            }}
          />

          <p className="text-sm text-ink-subtle">
            Everything stays on this machine. Nothing is uploaded anywhere.
          </p>
        </div>
      </main>
    </div>
  )
}
