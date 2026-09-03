import 'server-only'

import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { count, eq } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'

import { DATA_DIR, getDb } from '@/lib/db'
import { STARTER_BRAND_NAME } from '@/lib/db/constants'
import {
  alertConfigs,
  assets,
  brands,
  connectedAccounts,
  overlays,
  streamEvents,
} from '@/lib/db/schema'

/**
 * What this local install has actually been set up with.
 *
 * Read straight from the database rather than tracked as a separate "onboarding
 * complete" flag — if you delete your brand, the dashboard should say so.
 */
export type SetupState = {
  databaseReady: boolean
  hasBrand: boolean
  hasNamedBrand: boolean
  hasLogo: boolean
  hasConnectedAccount: boolean
  hasOverlay: boolean
  hasAlertConfig: boolean
}

function rowCount(table: SQLiteTable): number {
  return getDb().select({ value: count() }).from(table).get()?.value ?? 0
}

export function getSetupState(): SetupState {
  const db = getDb()

  // A brand exists on every install because one is seeded. What tells us the
  // creator has actually been through setup is whether they renamed it.
  const seededName = db
    .select({ name: brands.name })
    .from(brands)
    .where(eq(brands.name, STARTER_BRAND_NAME))
    .limit(1)
    .get()

  return {
    // Reaching this function at all means the database opened and migrated.
    databaseReady: true,
    hasBrand: rowCount(brands) > 0,
    hasNamedBrand: rowCount(brands) > 0 && seededName === undefined,
    hasLogo:
      db.select({ id: assets.id }).from(assets).where(eq(assets.type, 'logo')).limit(1).get() !==
      undefined,
    hasConnectedAccount: rowCount(connectedAccounts) > 0,
    hasOverlay: rowCount(overlays) > 0,
    hasAlertConfig: rowCount(alertConfigs) > 0,
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Row counts and file size, for the settings page. */
export function getStorageStats() {
  const dbPath = path.join(DATA_DIR, 'app.db')

  return {
    databaseSize: formatBytes(existsSync(dbPath) ? statSync(dbPath).size : 0),
    brands: rowCount(brands),
    assets: rowCount(assets),
    overlays: rowCount(overlays),
    alertConfigs: rowCount(alertConfigs),
    streamEvents: rowCount(streamEvents),
  }
}

/** True until the creator has set up their brand. Drives the welcome screen. */
export function needsOnboarding(): boolean {
  return !getSetupState().hasNamedBrand
}
