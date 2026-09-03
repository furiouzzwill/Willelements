import 'server-only'

import { eq } from 'drizzle-orm'

import { getDb } from '@/lib/db'
import { brands, type Brand } from '@/lib/db/schema'

/**
 * Brand DNA reads and writes.
 *
 * These are synchronous: better-sqlite3 talks to a local file, so there is no
 * IO to await. Server Components can call them directly.
 *
 * Phase 3 builds the Brand Studio on top of this. For now it exists so the
 * shell can show the brand name and the dashboard can tell you what is set up.
 */

/** The brand everything defaults to. Null until you create one in Phase 3. */
export function getDefaultBrand(): Brand | null {
  const explicit = getDb()
    .select()
    .from(brands)
    .where(eq(brands.isDefault, true))
    .limit(1)
    .get()

  if (explicit) return explicit

  // No explicit default yet — fall back to the first brand, if any exists.
  return getDb().select().from(brands).limit(1).get() ?? null
}

export function listBrands(): Brand[] {
  return getDb().select().from(brands).all()
}

export function countBrands(): number {
  return listBrands().length
}
