import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, describe } from 'node:test'
import Database from 'better-sqlite3'

import { migrate } from '../src/lib/db/migrations.ts'

const dirs: string[] = []

function freshDb() {
  const dir = mkdtempSync(path.join(tmpdir(), 'we-test-'))
  dirs.push(dir)
  const db = new Database(path.join(dir, 'test.db'))
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

function insertEvent(
  db: Database.Database,
  provider: string,
  providerEventId: string,
) {
  db.prepare(
    `INSERT INTO stream_events (id, provider, provider_event_id, type, occurred_at)
     VALUES (?, ?, ?, 'channel.follow', '2026-01-01T00:00:00.000Z')`,
  ).run(crypto.randomUUID(), provider, providerEventId)
}

describe('stream_events deduplication', () => {
  test('rejects a redelivered event from the same provider', () => {
    const db = freshDb()
    insertEvent(db, 'twitch', 'evt-1')

    assert.throws(
      () => insertEvent(db, 'twitch', 'evt-1'),
      /UNIQUE constraint failed/,
      'a duplicate (provider, provider_event_id) must be rejected by the database',
    )

    const total = db.prepare('SELECT COUNT(*) AS c FROM stream_events').get() as { c: number }
    assert.equal(total.c, 1)
  })

  test('allows the same event id from a different provider', () => {
    const db = freshDb()
    insertEvent(db, 'twitch', 'evt-1')
    insertEvent(db, 'youtube', 'evt-1')

    const total = db.prepare('SELECT COUNT(*) AS c FROM stream_events').get() as { c: number }
    assert.equal(total.c, 2)
  })
})

describe('overlay tokens', () => {
  test('two overlays cannot share a public token', () => {
    const db = freshDb()
    const insert = db.prepare(
      'INSERT INTO overlays (id, name, public_token) VALUES (?, ?, ?)',
    )
    insert.run(crypto.randomUUID(), 'One', 'token-a')

    assert.throws(
      () => insert.run(crypto.randomUUID(), 'Two', 'token-a'),
      /UNIQUE constraint failed/,
    )
  })
})

describe('cascades', () => {
  test('deleting an overlay removes its widgets', () => {
    const db = freshDb()
    const overlayId = crypto.randomUUID()

    db.prepare('INSERT INTO overlays (id, name, public_token) VALUES (?, ?, ?)').run(
      overlayId,
      'Main',
      'token-b',
    )
    db.prepare('INSERT INTO overlay_widgets (id, overlay_id, type) VALUES (?, ?, ?)').run(
      crypto.randomUUID(),
      overlayId,
      'text',
    )

    db.prepare('DELETE FROM overlays WHERE id = ?').run(overlayId)

    const widgets = db.prepare('SELECT COUNT(*) AS c FROM overlay_widgets').get() as {
      c: number
    }
    assert.equal(widgets.c, 0)
  })
})
