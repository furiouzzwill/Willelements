import Link from 'next/link'
import type { Metadata } from 'next'

import { AuthForm } from '@/app/(auth)/auth-form'
import { signIn } from '@/app/(auth)/actions'
import { SupabaseNotice } from '@/components/supabase-notice'
import { isSupabaseConfigured } from '@/lib/env'

export const metadata: Metadata = { title: 'Sign in' }

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const { next } = await searchParams
  const redirectTo = typeof next === 'string' && next.startsWith('/') ? next : undefined

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Welcome back
        </h1>
        <p className="text-sm text-ink-muted">Sign in to your creator workspace.</p>
      </div>

      {isSupabaseConfigured() ? (
        <AuthForm action={signIn} submitLabel="Sign in" next={redirectTo} />
      ) : (
        <SupabaseNotice />
      )}

      <p className="text-sm text-ink-subtle">
        New here?{' '}
        <Link href="/sign-up" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
