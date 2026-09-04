import 'server-only'

import { and, desc, eq } from 'drizzle-orm'

import { getDb } from '@/lib/db'
import { streamEvents, type StreamEvent } from '@/lib/db/schema'
import { publish } from '@/lib/events/bus'
import { EVENT_LABELS, type EventType, type NormalizedEvent } from '@/lib/schemas/event'

/**
 * The single door every event comes through.
 *
 * Providers hand normalized events here; this stores them, deduplicates them,
 * and fans them out. Nothing else writes to `stream_events`, so there is one
 * place to reason about ordering and one place duplicates can be stopped.
 */

export type RecordedEvent = {
  event: NormalizedEvent
  /** False when the database already had this event and it was ignored. */
  isNew: boolean
  /** How many overlay connections received it. */
  delivered: number
}

/**
 * Records an event and delivers it to connected overlays.
 *
 * Deduplication is the database's job: `(provider, provider_event_id)` is
 * unique, so a redelivered message is rejected by the constraint rather than
 * by application memory that dies with the process. A duplicate is stored
 * nowhere and delivered nowhere — replaying an alert for a follow that already
 * fired is worse than dropping it.
 */
export function recordEvent(event: NormalizedEvent): RecordedEvent {
  const inserted = getDb()
    .insert(streamEvents)
    .values({
      provider: event.provider,
      providerEventId: event.providerEventId,
      type: event.type,
      actor: event.actor,
      data: event.data,
      isTest: event.isTest,
      occurredAt: event.occurredAt,
    })
    .onConflictDoNothing()
    .returning()
    .all()

  if (inserted.length === 0) {
    return { event, isNew: false, delivered: 0 }
  }

  // Broadcast to every overlay. Which alert plays — or whether one plays at all
  // — is decided by each overlay from its own config.
  const delivered = publish(event)

  return { event, isNew: true, delivered }
}

export type ActivityEntry = {
  id: string
  type: EventType
  label: string
  provider: string
  actorName: string
  data: Record<string, unknown>
  isTest: boolean
  occurredAt: string
}

function toEntry(row: StreamEvent): ActivityEntry {
  const actor = (row.actor ?? {}) as { displayName?: string }

  return {
    id: row.id,
    type: row.type as EventType,
    label: EVENT_LABELS[row.type as EventType] ?? row.type,
    provider: row.provider,
    actorName: actor.displayName ?? 'Someone',
    data: (row.data ?? {}) as Record<string, unknown>,
    isTest: row.isTest,
    occurredAt: row.occurredAt,
  }
}

/**
 * Recent activity, newest first.
 *
 * Test events are excluded by default — they exist to check a setup, and
 * leaving them in the feed would make it impossible to tell at a glance what
 * actually happened on stream.
 */
export function listActivity(options: { limit?: number; includeTests?: boolean } = {}) {
  const { limit = 50, includeTests = false } = options
  const db = getDb()

  const query = db.select().from(streamEvents).orderBy(desc(streamEvents.occurredAt)).limit(limit)

  const rows = includeTests
    ? query.all()
    : query.where(eq(streamEvents.isTest, false)).all()

  return rows.map(toEntry)
}

export function countEvents(options: { includeTests?: boolean } = {}): number {
  const db = getDb()
  return options.includeTests
    ? db.select({ id: streamEvents.id }).from(streamEvents).all().length
    : db
        .select({ id: streamEvents.id })
        .from(streamEvents)
        .where(eq(streamEvents.isTest, false))
        .all().length
}

/** The most recent event of one type — powers "latest follower" style widgets. */
export function latestEventOfType(type: EventType): ActivityEntry | null {
  const row = getDb()
    .select()
    .from(streamEvents)
    .where(and(eq(streamEvents.type, type), eq(streamEvents.isTest, false)))
    .orderBy(desc(streamEvents.occurredAt))
    .limit(1)
    .get()

  return row ? toEntry(row) : null
}

/** Clears the activity history. Assets and configuration are untouched. */
export function clearActivity(): void {
  getDb().delete(streamEvents).run()
}
