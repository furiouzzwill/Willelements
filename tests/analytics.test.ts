import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, before, describe } from 'node:test'

/**
 * Analytics counts what happened, and nothing else.
 *
 * The rules worth protecting with tests are the ones that would be invisible
 * if they broke: a test event quietly inflating a total, a quiet day vanishing
 * from a chart, a stream that ended untracked being reported as days long.
 * Each of those produces a plausible-looking number, which is exactly why none
 * of them would be noticed by looking at the page.
 */

const workspace = mkdtempSync(path.join(tmpdir(), 'we-analytics-'))
process.env.WILLELEMENTS_DATA_DIR = workspace

type Analytics = typeof import('../src/lib/services/analytics-service.ts')
type StreamEvent = import('../src/lib/db/schema.ts').StreamEvent

let analytics: Analytics

before(async () => {
  analytics = await import('../src/lib/services/analytics-service.ts')
})

after(() => {
  rmSync(workspace, { recursive: true, force: true })
})

const NOW = new Date('2026-03-20T12:00:00.000Z')

/** A row shaped like the database returns, without touching the database. */
function row(
  type: string,
  occurredAt: string,
  extras: {
    actor?: { id: string; displayName: string }
    data?: Record<string, unknown>
    isTest?: boolean
    provider?: string
  } = {},
): StreamEvent {
  return {
    id: `${type}-${occurredAt}-${Math.random()}`,
    provider: extras.provider ?? 'twitch',
    providerEventId: `${type}-${occurredAt}`,
    type,
    actor: extras.actor ?? { id: 'u1', displayName: 'Someone' },
    data: extras.data ?? {},
    isTest: extras.isTest ?? false,
    occurredAt,
    createdAt: occurredAt,
  } as StreamEvent
}

describe('event totals', () => {
  test('every event type is present even at zero', () => {
    const totals = analytics.eventTotals([row('channel.follow', '2026-03-19T10:00:00.000Z')])

    assert.equal(totals.length, 7)
    assert.equal(totals.find((t) => t.type === 'channel.follow')?.count, 1)
    // A raid count that disappears in a quiet week reads as a broken page.
    assert.equal(totals.find((t) => t.type === 'channel.raid')?.count, 0)
  })

  test('an unknown type does not create a column', () => {
    const totals = analytics.eventTotals([row('channel.nonsense', '2026-03-19T10:00:00.000Z')])

    assert.equal(totals.length, 7)
    assert.ok(totals.every((t) => t.count === 0))
  })
})

describe('support totals', () => {
  test('bits, raid viewers and gifted subs are summed from the events', () => {
    const support = analytics.supportTotals([
      row('channel.cheer', '2026-03-19T10:00:00.000Z', { data: { bits: 100 } }),
      row('channel.cheer', '2026-03-19T11:00:00.000Z', { data: { bits: 250 } }),
      row('channel.raid', '2026-03-19T12:00:00.000Z', { data: { viewers: 40 } }),
      row('channel.subscription.gift', '2026-03-19T13:00:00.000Z', { data: { total: 5 } }),
    ])

    assert.equal(support.bits, 350)
    assert.equal(support.raidViewers, 40)
    assert.equal(support.giftedSubs, 5)
  })

  test('a missing or malformed amount counts as zero rather than NaN', () => {
    const support = analytics.supportTotals([
      row('channel.cheer', '2026-03-19T10:00:00.000Z', { data: {} }),
      row('channel.cheer', '2026-03-19T11:00:00.000Z', { data: { bits: 'lots' } }),
      row('channel.cheer', '2026-03-19T12:00:00.000Z', { data: { bits: 50 } }),
    ])

    // NaN would render as "NaN bits" on the page rather than failing loudly.
    assert.equal(support.bits, 50)
  })
})

describe('daily series', () => {
  test('a quiet day is a zero rather than a missing column', () => {
    const series = analytics.dailySeries(
      [row('channel.follow', '2026-03-20T09:00:00.000Z')],
      '7d',
      NOW,
    )

    assert.equal(series.length, 7)
    assert.equal(series.at(-1)?.date, '2026-03-20')
    assert.equal(series.at(-1)?.count, 1)
    // Dropping empty days would compress a quiet fortnight into a busy one.
    assert.ok(series.slice(0, 6).every((point) => point.count === 0))
  })

  test('the window length decides the column count, not the data', () => {
    assert.equal(analytics.dailySeries([], '7d', NOW).length, 7)
    assert.equal(analytics.dailySeries([], '30d', NOW).length, 30)
  })

  test('several events on one day land in one column', () => {
    const series = analytics.dailySeries(
      [
        row('channel.follow', '2026-03-20T01:00:00.000Z'),
        row('channel.follow', '2026-03-20T02:00:00.000Z'),
        row('channel.cheer', '2026-03-20T03:00:00.000Z'),
      ],
      '7d',
      NOW,
    )

    assert.equal(series.at(-1)?.count, 3)
  })

  test('all-time with no events is an empty series rather than a fabricated span', () => {
    assert.deepEqual(analytics.dailySeries([], 'all', NOW), [])
  })
})

describe('stream sessions', () => {
  test('an online paired with an offline becomes one finished session', () => {
    const sessions = analytics.streamSessions([
      row('stream.online', '2026-03-19T18:00:00.000Z'),
      row('channel.follow', '2026-03-19T19:00:00.000Z'),
      row('stream.offline', '2026-03-19T21:00:00.000Z'),
    ])

    assert.equal(sessions.length, 1)
    assert.equal(sessions[0].durationMs, 3 * 3_600_000)
    assert.equal(sessions[0].eventCount, 1)
    assert.equal(sessions[0].live, false)
  })

  test('a stream still running has no duration', () => {
    const sessions = analytics.streamSessions([row('stream.online', '2026-03-20T10:00:00.000Z')])

    assert.equal(sessions.length, 1)
    assert.equal(sessions[0].live, true)
    // Measuring an open stream against now would grow a number nobody reported.
    assert.equal(sessions[0].durationMs, null)
    assert.equal(sessions[0].endedAt, null)
  })

  test('a missed offline does not swallow the next stream', () => {
    const sessions = analytics.streamSessions([
      row('stream.online', '2026-03-18T18:00:00.000Z'),
      row('stream.online', '2026-03-19T18:00:00.000Z'),
      row('stream.offline', '2026-03-19T20:00:00.000Z'),
    ])

    assert.equal(sessions.length, 2)
    // Newest first.
    assert.equal(sessions[0].startedAt, '2026-03-19T18:00:00.000Z')
    assert.equal(sessions[0].durationMs, 2 * 3_600_000)
    // The abandoned one stays null rather than being stretched to the next start.
    assert.equal(sessions[1].durationMs, null)
  })

  test('an offline with no online before it is ignored rather than invented', () => {
    const sessions = analytics.streamSessions([row('stream.offline', '2026-03-19T20:00:00.000Z')])

    assert.deepEqual(sessions, [])
  })

  test('online and offline markers are not counted as stream activity', () => {
    const sessions = analytics.streamSessions([
      row('stream.online', '2026-03-19T18:00:00.000Z'),
      row('stream.offline', '2026-03-19T20:00:00.000Z'),
    ])

    assert.equal(sessions[0].eventCount, 0)
  })
})

describe('top supporters', () => {
  test('the same person across several events is one entry', () => {
    const alice = { id: 'u-alice', displayName: 'Alice' }
    const top = analytics.topSupporters(
      [
        row('channel.cheer', '2026-03-19T10:00:00.000Z', { actor: alice, data: { bits: 100 } }),
        row('channel.cheer', '2026-03-19T11:00:00.000Z', { actor: alice, data: { bits: 200 } }),
      ],
      'channel.cheer',
    )

    assert.equal(top.length, 1)
    assert.equal(top[0].value, 300)
    assert.equal(top[0].occurrences, 2)
  })

  test('grouping is by id, so a rename does not split someone in two', () => {
    const top = analytics.topSupporters(
      [
        row('channel.cheer', '2026-03-19T10:00:00.000Z', {
          actor: { id: 'u-1', displayName: 'OldName' },
          data: { bits: 100 },
        }),
        row('channel.cheer', '2026-03-19T11:00:00.000Z', {
          actor: { id: 'u-1', displayName: 'NewName' },
          data: { bits: 100 },
        }),
      ],
      'channel.cheer',
    )

    assert.equal(top.length, 1)
    assert.equal(top[0].value, 200)
  })

  test('ordered by amount, biggest first', () => {
    const top = analytics.topSupporters(
      [
        row('channel.raid', '2026-03-19T10:00:00.000Z', {
          actor: { id: 'a', displayName: 'Small' },
          data: { viewers: 5 },
        }),
        row('channel.raid', '2026-03-19T11:00:00.000Z', {
          actor: { id: 'b', displayName: 'Big' },
          data: { viewers: 500 },
        }),
      ],
      'channel.raid',
    )

    assert.equal(top[0].name, 'Big')
    assert.equal(top[1].name, 'Small')
  })
})

describe('recent actors', () => {
  test('newest first, one row per person', () => {
    const recent = analytics.recentActors(
      [
        row('channel.follow', '2026-03-18T10:00:00.000Z', {
          actor: { id: 'a', displayName: 'First' },
        }),
        row('channel.follow', '2026-03-19T10:00:00.000Z', {
          actor: { id: 'b', displayName: 'Second' },
        }),
        row('channel.follow', '2026-03-20T10:00:00.000Z', {
          actor: { id: 'a', displayName: 'First' },
        }),
      ],
      'channel.follow',
    )

    assert.equal(recent.length, 2)
    assert.equal(recent[0].name, 'First')
    assert.equal(recent[0].occurredAt, '2026-03-20T10:00:00.000Z')
    assert.equal(recent[1].name, 'Second')
  })
})

describe('windows', () => {
  test('an unknown window falls back to 30 days rather than throwing', () => {
    assert.equal(analytics.parseWindow('nonsense'), '30d')
    assert.equal(analytics.parseWindow(undefined), '30d')
    assert.equal(analytics.parseWindow('7d'), '7d')
    assert.equal(analytics.parseWindow('all'), 'all')
  })
})
