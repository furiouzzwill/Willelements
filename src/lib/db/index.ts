import 'server-only'

import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { migrate } from '@/lib/db/migrations'
import * as schema from '@/lib/db/schema'

/**
 * The local database.
 *
 * Everything this app knows lives in one directory. Back it up by copying that
 * directory; move it to another machine the same way.
 *
 *   data/
 *   ├── app.db          SQLite database
 *   └── assets/         Uploaded and generated files
 *
 * Override the location with WILLELEMENTS_DATA_DIR.
 */

export const DATA_DIR = process.env.WILLELEMENTS_DATA_DIR
  ? path.resolve(process.env.WILLELEMENTS_DATA_DIR)
  : path.join(process.cwd(), 'data')

export const ASSETS_DIR = path.join(DATA_DIR, 'assets')

const DB_PATH = path.join(DATA_DIR, 'app.db')

function open() {
  mkdirSync(DATA_DIR, { recursive: true })
  mkdirSync(ASSETS_DIR, { recursive: true })

  const isNew = !existsSync(DB_PATH)
  const sqlite = new Database(DB_PATH)

  // WAL keeps reads from blocking writes — the overlay stream reads constantly
  // while events are being written, and stalling it would show up on stream.
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  // Wait rather than throwing if a write is briefly in progress.
  sqlite.pragma('busy_timeout = 5000')

  const { applied } = migrate(sqlite)
  if (applied.length > 0) {
    console.log(
      `[db] ${isNew ? 'Created' : 'Updated'} ${DB_PATH} (${applied.join(', ')})`,
    )
  }

  return drizzle(sqlite, { schema })
}

/**
 * One connection per process, opened on first use and cached across hot reloads.
 *
 * Opening lazily matters: `next build` evaluates every page module to collect
 * route data, and a connection created at module scope would make a build
 * create your data directory as a side effect. It also keeps hot reload from
 * leaking a new SQLite handle on every file change.
 */
const globalForDb = globalThis as unknown as {
  __willelementsDb?: ReturnType<typeof open>
}

export function getDb() {
  if (!globalForDb.__willelementsDb) {
    globalForDb.__willelementsDb = open()
  }
  return globalForDb.__willelementsDb
}

export { schema }
