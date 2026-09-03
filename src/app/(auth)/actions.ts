'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { siteUrl } from '@/lib/env'

/**
 * Authentication server actions.
 *
 * These own the platform account only. Connecting Twitch or YouTube is a
 * separate concept handled by `connected_accounts` (Phase 4) — a creator's
 * channel is never their identity here.
 */

export type AuthFormState = { error?: string; fieldErrors?: Record<string, string> }

const credentials = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
})

const signUpInput = credentials.extend({
  displayName: z
    .string()
    .trim()
    .min(2, 'Enter at least 2 characters.')
    .max(50, 'Keep this under 50 characters.'),
})

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !result[key]) result[key] = issue.message
  }
  return result
}

/**
 * Supabase returns a deliberately vague error for a bad email *or* a bad
 * password. We keep it vague too rather than confirming which accounts exist.
 */
export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: 'That email and password combination did not work.' }
  }

  const next = formData.get('next')
  revalidatePath('/', 'layout')
  redirect(typeof next === 'string' && next.startsWith('/') ? next : '/dashboard')
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpInput.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    displayName: formData.get('displayName'),
  })

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  const { email, password, displayName } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  // With email confirmation on, Supabase returns a user but no session.
  if (!data.session) {
    redirect(`/check-email?email=${encodeURIComponent(email)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/sign-in')
}
