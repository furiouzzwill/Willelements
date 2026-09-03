import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, describe } from 'node:test'
import Database from 'better-sqlite3'
import { getTableColumns, getTableName, is, Table } from 'drizzle-orm'

import { migrate } from '../src/lib/db/migrations.ts'
import * as schema from '../src/lib/db/schema.ts'

/**
 * The Drizzle schema and the migrations must describe the same database.
 *
 * They are written by hand and independently, so they can drift. This caught a
 * real bug: a shared timestamp helper hardcoded the column name `created_at`,
 * so every `updated_at` and `connected_at` field silently mapped onto the wrong
 * column — writing to `created_at` on tables that had one, and failing outright
 * on tables that did not.
 *
 * A per-table test would not have found it. This checks every column of every
 * table, so the next helper mistake fails immediately.
 */

const dirs: string[] = []

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

function migratedDb() {
  const dir = mkdtempSync(path.join(tmpdir(), 'we-mapping-'))
  dirs.push(dir)
  const db = new Database(path.join(dir, 'test.db'))
  migrate(db)
  return db
}

function actualColumns(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]
  return new Set(rows.map((row) => row.name))
}

/** Every exported Drizzle table, discovered rather than listed by hand. */
const tables = Object.values(schema).filter((value) => is(value, Table))

describe('schema and migrations agree', () => {
  test('discovers every table', () => {
    const names = tables.map((table) => getTableName(table)).sort()

    assert.deepEqual(names, [
      'alert_configs',
      'assets',
      'brands',
      'connected_accounts',
      'overlay_widgets',
      'overlays',
      'stream_events',
    ])
  })

  for (const table of tables) {
    const tableName = getTableName(table)

    test(`${tableName}: every mapped column exists in the database`, () => {
      const db = migratedDb()
      const existing = actualColumns(db, tableName)
      const mapped = Object.values(getTableColumns(table)).map((column) => column.name)

      for (const column of mapped) {
        assert.ok(
          existing.has(column),
          `${tableName}.${column} is in the Drizzle schema but not in the migration`,
        )
      }
    })

    test(`${tableName}: no two fields map to the same column`, () => {
      // The exact shape of the bug: two fields, one SQL column name.
      const mapped = Object.entries(getTableColumns(table)).map(
        ([field, column]) => [field, column.name] as const,
      )
      const seen = new Map<string, string>()

      for (const [field, column] of mapped) {
        const previous = seen.get(column)
        assert.equal(
          previous,
          undefined,
          `${tableName}.${field} and ${tableName}.${previous} both map to "${column}"`,
        )
        seen.set(column, field)
      }
    })

    test(`${tableName}: the migration has no columns the schema forgot`, () => {
      const db = migratedDb()
      const existing = actualColumns(db, tableName)
      const mapped = new Set(Object.values(getTableColumns(table)).map((c) => c.name))

      for (const column of existing) {
        assert.ok(
          mapped.has(column),
          `${tableName}.${column} exists in the database but nothing in the schema reads it`,
        )
      }
    })
  }
})
