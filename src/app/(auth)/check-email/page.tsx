import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Confirm your email' }

export default async function CheckEmailPage({ searchParams }: PageProps<'/check-email'>) {
  const { email } = await searchParams
  const address = typeof email === 'string' ? email : null

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Confirm your email
        </h1>
        <p className="text-sm text-ink-muted">
          We sent a confirmation link
          {address ? (
            <>
              {' '}
              to <span className="text-ink">{address}</span>
            </>
          ) : null}
          . Open it to finish setting up your workspace.
        </p>
      </div>

      <p className="text-sm text-ink-subtle">
        Already confirmed?{' '}
        <Link href="/sign-in" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
