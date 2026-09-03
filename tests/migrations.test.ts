import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, describe } from 'node:test'
import Database from 'better-sqlite3'

import { LATEST_VERSION, migrate } from '../src/lib/db/migrations.ts'

const dirs: string[] = []

function freshDb() {
  const dir = mkdtempSync(path.join(tmpdir(), 'we-test-'))
  dirs.push(dir)
  const db = new Database(path.join(dir, 'test.db'))
  db.pragma('foreign_keys = ON')
  return db
}

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

function tableNames(db: Database.Database): string[] {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((row) => (row as { name: string }).name)
    .sort()
}

describe('migrations', () => {
  test('creates every table and stamps the version', () => {
    const db = freshDb()
    const { applied } = migrate(db)

    assert.equal(applied.length, LATEST_VERSION)
    assert.equal(db.pragma('user_version', { simple: true }), LATEST_VERSION)
    assert.deepEqual(tableNames(db), [
      'alert_configs',
      'assets',
      'brands',
      'connected_accounts',
      'overlay_widgets',
      'overlays',
      'stream_events',
    ])
  })

  test('is idempotent — running twice applies nothing the second time', () => {
    const db = freshDb()
    migrate(db)
    const second = migrate(db)

    assert.deepEqual(second.applied, [])
    assert.equal(db.pragma('user_version', { simple: true }), LATEST_VERSION)
  })

  test('a second connection to the same file does not re-run migrations', () => {
    // This is the case that broke the build: several processes opening one
    // database at once, each reading user_version before any had written it.
    const dir = mkdtempSync(path.join(tmpdir(), 'we-test-'))
    dirs.push(dir)
    const file = path.join(dir, 'shared.db')

    const first = new Database(file)
    const second = new Database(file)

    const a = migrate(first)
    const b = migrate(second)

    assert.equal(a.applied.length, LATEST_VERSION)
    assert.deepEqual(b.applied, [], 'the second connection should apply nothing')
  })
})
