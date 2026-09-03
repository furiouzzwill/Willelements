import Link from 'next/link'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Icon, Wordmark } from '@/components/ui/icon'
import type { IconName } from '@/config/navigation'

export const metadata: Metadata = {
  title: 'Willelements — AI-native platform for streamers',
}

const pillars: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'brand',
    title: 'Brand DNA',
    body: 'One persistent identity — colours, type, visual and motion style — that every generated asset inherits.',
  },
  {
    icon: 'stream',
    title: 'Overlays that hold up live',
    body: 'Lightweight OBS browser sources built to reconnect, queue alerts and keep rendering when a provider hiccups.',
  },
  {
    icon: 'sparkle',
    title: 'Creation, not prompting',
    body: 'Say “create alert”, not “generate a composition”. The technical work stays behind the product.',
  },
  {
    icon: 'analytics',
    title: 'Your real numbers',
    body: 'Metrics come straight from the platforms you connect. Nothing is estimated, nothing is invented.',
  },
]

/**
 * Public marketing page. Deliberately does *not* read the session: touching
 * cookies here would turn the most-visited public route into a per-request
 * render. A signed-in creator who clicks "Sign in" is bounced straight to the
 * dashboard by `src/proxy.ts`, so the static version is still correct for them.
 */
export default function LandingPage() {
  return (
    <div className="aurora min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <ButtonLink href="/sign-in" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/sign-up" size="sm">
            Get started
          </ButtonLink>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="py-20 sm:py-28">
          <p className="font-display text-xs font-semibold tracking-[0.18em] text-accent uppercase">
            AI-native creator platform
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-ink sm:text-6xl">
            Build your brand. Power your stream. Grow your community.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-muted">
            Your entire stream, built around your brand — overlays, alerts, graphics and
            analytics that all come from one creative identity.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ButtonLink href="/sign-up" size="lg">
              Create your account
            </ButtonLink>
            <Link
              href="/sign-in"
              className="text-sm font-medium text-ink-muted hover:text-ink"
            >
              I already have an account
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="panel space-y-3 p-6">
              <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
                <Icon name={pillar.icon} className="size-4.5" />
              </span>
              <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                {pillar.title}
              </h2>
              <p className="text-sm text-ink-muted">{pillar.body}</p>
            </article>
          ))}
        </section>

        <section className="panel mt-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <p className="text-sm text-ink-muted">
            <span className="font-display font-semibold text-ink">Early development.</span>{' '}
            The foundation is live; Twitch, overlays and AI creation are on the roadmap.
          </p>
          <ButtonLink href="/sign-up" variant="secondary" size="sm">
            Get started
          </ButtonLink>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-ink-subtle">
          Willelements — an AI-native operating system for streamers.
        </div>
      </footer>
    </div>
  )
}
