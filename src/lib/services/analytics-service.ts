import 'server-only'

import { and, asc, desc, eq, gte } from 'drizzle-orm'

import { getDb } from '@/lib/db'
import { streamEvents, type StreamEvent } from '@/lib/db/schema'
import { EVENT_LABELS, EVENT_TYPES, type EventType } from '@/lib/schemas/event'

/**
 * Analytics over what actually happened.
 *
 * Every figure here is counted from `stream_events` — rows a provider put
 * there. Nothing is modelled, projected or filled in, because the product rule
 * is that a number nobody gave us is a bug rather than a nice default. Where
 * there is no data the answer is an empty array or null, and the page says so.
 *
 * Two exclusions are structural rather than optional:
 *
 *  - **Test events never count.** They exist to check a setup. A test raid
 *    inflating your raid total would make the number worthless, and worse,
 *    quietly.
 *  - **Providers stay separate.** A combined "total followers" across Twitch
 *    and YouTube would be a figure neither provider agrees with. Rows carry
 *    their provider and callers ask for one.
 */

/** How far back a page is looking. `all` means every row we hold. */
export type Window = '7d' | '30d' | 'all'

export const WINDOWS: Window[] = ['7d', '30d', 'all']

export const WINDOW_LABELS: Record<Window, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
}

export function parseWindow(value: string | string[] | undefined): Window {
  return WINDOWS.includes(value as Window) ? (value as Window) : '30d'
}

/** The ISO cutoff for a window, or null for `all`. */
function since(window: Window, now = new Date()): string | null {
  if (window === 'all') return null
  const days = window === '7d' ? 7 : 30
  return new Date(now.getTime() - days * 86_400_000).toISOString()
}

/**
 * Real events in a window, oldest first.
 *
 * One query feeds every aggregation on a page. The alternative — a query per
 * tile — reads the same rows five times for a table that is small by
 * construction, since it only ever holds what happened on one person's channel.
 */
function realEvents(window: Window, provider?: string, now = new Date()): StreamEvent[] {
  const cutoff = since(window, now)

  const conditions = [eq(streamEvents.isTest, false)]
  if (cutoff) conditions.push(gte(streamEvents.occurredAt, cutoff))
  if (provider) conditions.push(eq(streamEvents.provider, provider))

  return getDb()
    .select()
    .from(streamEvents)
    .where(and(...conditions))
    .orderBy(asc(streamEvents.occurredAt))
    .all()
}

function actorName(row: StreamEvent): string {
  const actor = (row.actor ?? {}) as { displayName?: string }
  return actor.displayName ?? 'Someone'
}

function actorId(row: StreamEvent): string {
  const actor = (row.actor ?? {}) as { id?: string; displayName?: string }
  return actor.id ?? actor.displayName ?? 'unknown'
}

function num(row: StreamEvent, key: 'viewers' | 'bits' | 'total'): number {
  const data = (row.data ?? {}) as Record<string, unknown>
  const value = data[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/* -------------------------------------------------------------------------- */
/* Totals                                                                     */
/* -------------------------------------------------------------------------- */

export type EventTotal = {
  type: EventType
  label: string
  count: number
}

/**
 * How many of each event type happened.
 *
 * Every type is present even at zero. A follow count that vanishes from the
 * page in a quiet week reads as a broken page rather than a quiet week.
 */
export function eventTotals(rows: StreamEvent[]): EventTotal[] {
  const counts = new Map<EventType, number>(EVENT_TYPES.map((type) => [type, 0]))

  for (const row of rows) {
    const type = row.type as EventType
    if (counts.has(type)) counts.set(type, (counts.get(type) ?? 0) + 1)
  }

  return EVENT_TYPES.map((type) => ({
    type,
    label: EVENT_LABELS[type],
    count: counts.get(type) ?? 0,
  }))
}

/** Bits cheered and raid viewers received — summed from the events themselves. */
export function supportTotals(rows: StreamEvent[]): { bits: number; raidViewers: number; giftedSubs: number } {
  let bits = 0
  let raidViewers = 0
  let giftedSubs = 0

  for (const row of rows) {
    if (row.type === 'channel.cheer') bits += num(row, 'bits')
    if (row.type === 'channel.raid') raidViewers += num(row, 'viewers')
    if (row.type === 'channel.subscription.gift') giftedSubs += num(row, 'total')
  }

  return { bits, raidViewers, giftedSubs }
}

/* -------------------------------------------------------------------------- */
/* Daily series                                                               */
/* -------------------------------------------------------------------------- */

export type DailyPoint = {
  /** YYYY-MM-DD */
  date: string
  count: number
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * Events per day across the window, including days where nothing happened.
 *
 * The zero days matter: a chart that silently drops them compresses a quiet
 * fortnight into the width of a busy one and makes a decline look like a
 * plateau.
 */
export function dailySeries(rows: StreamEvent[], window: Window, now = new Date()): DailyPoint[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = dayKey(row.occurredAt)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  // `all` spans from the first event we hold; a fixed window spans its own
  // length, so an empty week still renders as seven empty days.
  const days = window === 'all' ? spanDays(rows, now) : window === '7d' ? 7 : 30
  if (days === 0) return []

  const series: DailyPoint[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now.getTime() - i * 86_400_000)
    const key = date.toISOString().slice(0, 10)
    series.push({ date: key, count: counts.get(key) ?? 0 })
  }

  return series
}

/** Days from the earliest event to today, capped so an old row cannot render thousands of columns. */
function spanDays(rows: StreamEvent[], now: Date): number {
  if (rows.length === 0) return 0
  const first = new Date(rows[0].occurredAt).getTime()
  const days = Math.floor((now.getTime() - first) / 86_400_000) + 1
  return Math.min(Math.max(days, 1), 90)
}

/* -------------------------------------------------------------------------- */
/* Stream sessions                                                            */
/* -------------------------------------------------------------------------- */

export type StreamSession = {
  startedAt: string
  /** Null while a stream is still running, or if we never saw it end. */
  endedAt: string | null
  /** Null when `endedAt` is, rather than a duration measured against now. */
  durationMs: number | null
  /** Real events recorded between the two timestamps. */
  eventCount: number
  live: boolean
}

/**
 * Streams, derived by pairing `stream.online` with the next `stream.offline`.
 *
 * The pairing has to tolerate a missing half. The app is not running when the
 * machine is off, so an offline event can arrive with no online before it, and
 * a stream can end while the app is closed and never produce one at all. Both
 * cases yield a session with a null on that side rather than a guessed
 * timestamp, and duration stays null instead of being measured to now — a
 * stream that ended untracked on Tuesday is not 96 hours long.
 */
export function streamSessions(rows: StreamEvent[]): StreamSession[] {
  const sessions: StreamSession[] = []
  let open: { startedAt: string } | null = null

  for (const row of rows) {
    if (row.type === 'stream.online') {
      // Two onlines in a row means we missed the end of the first.
      if (open) sessions.push(close(open, null, rows))
      open = { startedAt: row.occurredAt }
      continue
    }

    if (row.type === 'stream.offline' && open) {
      sessions.push(close(open, row.occurredAt, rows))
      open = null
    }
  }

  if (open) sessions.push(close(open, null, rows, true))

  return sessions.reverse()
}

function close(
  open: { startedAt: string },
  endedAt: string | null,
  rows: StreamEvent[],
  live = false,
): StreamSession {
  const start = new Date(open.startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : null

  const eventCount = rows.filter((row) => {
    if (row.type === 'stream.online' || row.type === 'stream.offline') return false
    const at = new Date(row.occurredAt).getTime()
    return at >= start && (end === null || at <= end)
  }).length

  return {
    startedAt: open.startedAt,
    endedAt,
    durationMs: end === null ? null : Math.max(0, end - start),
    eventCount,
    live,
  }
}

/* -------------------------------------------------------------------------- */
/* Audience                                                                   */
/* -------------------------------------------------------------------------- */

export type Supporter = {
  id: string
  name: string
  /** Bits, raid viewers or gifted subs, depending on which list this is. */
  value: number
  occurrences: number
}

/**
 * The people behind one kind of support, biggest first.
 *
 * Grouped by the provider's actor id rather than display name, so someone who
 * changes their name is one person rather than two.
 */
export function topSupporters(
  rows: StreamEvent[],
  type: 'channel.cheer' | 'channel.raid' | 'channel.subscription.gift',
  limit = 10,
): Supporter[] {
  const key = type === 'channel.cheer' ? 'bits' : type === 'channel.raid' ? 'viewers' : 'total'
  const totals = new Map<string, Supporter>()

  for (const row of rows) {
    if (row.type !== type) continue

    const id = actorId(row)
    const existing = totals.get(id)
    const value = num(row, key)

    if (existing) {
      existing.value += value
      existing.occurrences += 1
    } else {
      totals.set(id, { id, name: actorName(row), value, occurrences: 1 })
    }
  }

  return [...totals.values()]
    .sort((a, b) => b.value - a.value || b.occurrences - a.occurrences)
    .slice(0, limit)
}

export type RecentActor = {
  id: string
  name: string
  occurredAt: string
}

/** The most recent people of one event type, newest first. */
export function recentActors(rows: StreamEvent[], type: EventType, limit = 10): RecentActor[] {
  const seen = new Set<string>()
  const out: RecentActor[] = []

  for (let i = rows.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const row = rows[i]
    if (row.type !== type) continue

    const id = actorId(row)
    if (seen.has(id)) continue

    seen.add(id)
    out.push({ id, name: actorName(row), occurredAt: row.occurredAt })
  }

  return out
}

/* -------------------------------------------------------------------------- */
/* Page-level reads                                                           */
/* -------------------------------------------------------------------------- */

export type AnalyticsSummary = {
  window: Window
  /** Real events in the window. */
  total: number
  totals: EventTotal[]
  support: { bits: number; raidViewers: number; giftedSubs: number }
  series: DailyPoint[]
  /** Null when nothing has ever been recorded, so pages can offer a first-run state. */
  firstEventAt: string | null
  /** True when the database holds no real events at all, in any window. */
  empty: boolean
}

export function analyticsSummary(window: Window, provider?: string, now = new Date()): AnalyticsSummary {
  const rows = realEvents(window, provider, now)

  return {
    window,
    total: rows.length,
    totals: eventTotals(rows),
    support: supportTotals(rows),
    series: dailySeries(rows, window, now),
    firstEventAt: firstRealEventAt(provider),
    empty: firstRealEventAt(provider) === null,
  }
}

/** The earliest real event we hold, which is when this channel's history starts. */
export function firstRealEventAt(provider?: string): string | null {
  const conditions = [eq(streamEvents.isTest, false)]
  if (provider) conditions.push(eq(streamEvents.provider, provider))

  const row = getDb()
    .select({ occurredAt: streamEvents.occurredAt })
    .from(streamEvents)
    .where(and(...conditions))
    .orderBy(asc(streamEvents.occurredAt))
    .limit(1)
    .get()

  return row?.occurredAt ?? null
}

export type StreamsReport = {
  window: Window
  sessions: StreamSession[]
  /** Averages over finished sessions only — an open one has no length yet. */
  finishedCount: number
  averageDurationMs: number | null
  longestDurationMs: number | null
  totalDurationMs: number
}

export function streamsReport(window: Window, now = new Date()): StreamsReport {
  const sessions = streamSessions(realEvents(window, undefined, now))
  const finished = sessions.filter((session) => session.durationMs !== null)
  const durations = finished.map((session) => session.durationMs ?? 0)

  return {
    window,
    sessions,
    finishedCount: finished.length,
    averageDurationMs: durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : null,
    longestDurationMs: durations.length ? Math.max(...durations) : null,
    totalDurationMs: durations.reduce((sum, value) => sum + value, 0),
  }
}

export type AudienceReport = {
  window: Window
  cheerers: Supporter[]
  raiders: Supporter[]
  gifters: Supporter[]
  recentFollowers: RecentActor[]
  recentSubscribers: RecentActor[]
  empty: boolean
}

export function audienceReport(window: Window, now = new Date()): AudienceReport {
  const rows = realEvents(window, undefined, now)

  return {
    window,
    cheerers: topSupporters(rows, 'channel.cheer'),
    raiders: topSupporters(rows, 'channel.raid'),
    gifters: topSupporters(rows, 'channel.subscription.gift'),
    recentFollowers: recentActors(rows, 'channel.follow'),
    recentSubscribers: recentActors(rows, 'channel.subscribe'),
    empty: rows.length === 0,
  }
}

/** The newest real event, for "last activity" lines. */
export function lastRealEventAt(provider?: string): string | null {
  const conditions = [eq(streamEvents.isTest, false)]
  if (provider) conditions.push(eq(streamEvents.provider, provider))

  const row = getDb()
    .select({ occurredAt: streamEvents.occurredAt })
    .from(streamEvents)
    .where(and(...conditions))
    .orderBy(desc(streamEvents.occurredAt))
    .limit(1)
    .get()

  return row?.occurredAt ?? null
}
