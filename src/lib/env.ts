import { z } from 'zod'

/**
 * Environment configuration.
 *
 * Two rules that must hold for the life of this project:
 *
 *  1. Anything reachable from the browser lives in `publicEnv` and is prefixed
 *     `NEXT_PUBLIC_`. Everything else is server-only and must never be imported
 *     from a Client Component.
 *  2. Server secrets are read lazily (`serverEnv()`), never at module scope, so
 *     that a missing Twitch/OpenAI key does not break the whole app before those
 *     phases ship.
 *
 * Supabase is migrating from the legacy `anon` / `service_role` keys to
 * `sb_publishable_…` / `sb_secret_…`. We prefer the new names and fall back to
 * the legacy ones so existing projects keep working.
 * See docs/deployment.md for the full variable list.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
})

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` only for statically analysable
 * member expressions, so these have to be written out longhand.
 */
const rawPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
}

export type PublicEnv = z.infer<typeof publicSchema>

let cachedPublicEnv: PublicEnv | null = null

/**
 * Throws with an actionable message when Supabase is not configured. Call this
 * from anywhere that genuinely needs Supabase; use `isSupabaseConfigured()`
 * when you want to degrade gracefully instead.
 */
export function publicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv

  const parsed = publicSchema.safeParse(rawPublicEnv)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(
      `Supabase is not configured. Missing or invalid environment variables: ${missing}. ` +
        `Copy .env.example to .env.local and fill in your project values.`,
    )
  }

  cachedPublicEnv = parsed.data
  return cachedPublicEnv
}

export function isSupabaseConfigured(): boolean {
  return publicSchema.safeParse(rawPublicEnv).success
}

/**
 * Absolute origin of this deployment, used to build OAuth redirect URLs and
 * OBS browser-source URLs. Vercel sets `VERCEL_PROJECT_PRODUCTION_URL` on all
 * environments of a project, which is a stable alias for the production
 * deployment.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${vercel}`

  return 'http://localhost:3000'
}
