import Link from 'next/link'
import type { Metadata } from 'next'

import { AuthForm } from '@/app/(auth)/auth-form'
import { signUp } from '@/app/(auth)/actions'
import { SupabaseNotice } from '@/components/supabase-notice'
import { isSupabaseConfigured } from '@/lib/env'

export const metadata: Metadata = { title: 'Create your account' }

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Create your account
        </h1>
        <p className="text-sm text-ink-muted">
          Build your brand. Power your stream. Grow your community.
        </p>
      </div>

      {isSupabaseConfigured() ? (
        <AuthForm action={signUp} submitLabel="Create account" includeDisplayName />
      ) : (
        <SupabaseNotice />
      )}

      <p className="text-sm text-ink-subtle">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
