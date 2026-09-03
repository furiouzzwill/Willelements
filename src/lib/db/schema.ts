import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

/**
 * Local schema.
 *
 * This is a single-user application: everything in this database belongs to the
 * one person running it, so there are no owner columns and no access rules to
 * enforce. The file itself is the security boundary.
 *
 * Conventions:
 *  - Text UUIDs for primary keys. Not strictly needed locally, but it keeps
 *    identifiers non-sequential, which matters for the overlay tokens.
 *  - Timestamps are ISO-8601 strings, so the database file stays readable if
 *    you ever open it by hand.
 *  - Anything shaped like free-form structure (Brand DNA, widget config, alert
 *    specs) is JSON in a text column, validated by Zod on the way in and out.
 */

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

/**
 * An ISO-8601 timestamp column defaulting to now.
 *
 * The SQL column name is an argument rather than hardcoded: an earlier version
 * of this helper always emitted `created_at`, which silently mapped every
 * `updated_at` and `connected_at` field onto the wrong column.
 */
const timestamp = (column: string) =>
  text(column)
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)

/** The creator's persistent visual identity. Drives every generated asset. */
export const brands = sqliteTable('brands', {
  id: id(),
  name: text('name').notNull(),
  description: text('description'),
  audience: text('audience'),
  creatorType: text('creator_type'),
  /** JSON: personality[], colors, typography, visualStyle, motionStyle, rules */
  dna: text('dna', { mode: 'json' }).notNull().default(sql`'{}'`),
  logoAssetId: text('logo_asset_id'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

/** Uploaded and generated files. The bytes live under ./data/assets. */
export const assets = sqliteTable(
  'assets',
  {
    id: id(),
    brandId: text('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    /** logo | image | background | animation | video | sound */
    type: text('type').notNull(),
    /** upload | generated */
    source: text('source').notNull(),
    /** Path relative to the data directory — never absolute, never user input. */
    filePath: text('file_path').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: integer('file_size'),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    /** Generation provenance, for reproducing a result and for brand learning. */
    prompt: text('prompt'),
    provider: text('provider'),
    model: text('model'),
    approved: integer('approved', { mode: 'boolean' }).notNull().default(false),
    favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
    createdAt: timestamp('created_at'),
  },
  (table) => [index('assets_type_idx').on(table.type)],
)

/** A saved canvas of widgets, addressable by OBS through its public token. */
export const overlays = sqliteTable(
  'overlays',
  {
    id: id(),
    brandId: text('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    canvasWidth: integer('canvas_width').notNull().default(1920),
    canvasHeight: integer('canvas_height').notNull().default(1080),
    settings: text('settings', { mode: 'json' }).notNull().default(sql`'{}'`),
    /**
     * The opaque identifier that appears in the OBS browser-source URL.
     * Deliberately separate from `id` so it can be rotated without breaking
     * anything that references the overlay.
     */
    publicToken: text('public_token').notNull(),
    tokenRotatedAt: timestamp('token_rotated_at'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [uniqueIndex('overlays_public_token_idx').on(table.publicToken)],
)

export const overlayWidgets = sqliteTable(
  'overlay_widgets',
  {
    id: id(),
    overlayId: text('overlay_id')
      .notNull()
      .references(() => overlays.id, { onDelete: 'cascade' }),
    /** Must match a key in the widget registry; unknown types are rejected. */
    type: text('type').notNull(),
    config: text('config', { mode: 'json' }).notNull().default(sql`'{}'`),
    x: integer('x').notNull().default(0),
    y: integer('y').notNull().default(0),
    width: integer('width').notNull().default(400),
    height: integer('height').notNull().default(200),
    zIndex: integer('z_index').notNull().default(0),
    locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
    createdAt: timestamp('created_at'),
  },
  (table) => [index('overlay_widgets_overlay_idx').on(table.overlayId)],
)

/** How a given event type should look and sound when it fires. */
export const alertConfigs = sqliteTable(
  'alert_configs',
  {
    id: id(),
    brandId: text('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    /** Internal event type, e.g. channel.follow */
    eventType: text('event_type').notNull(),
    /** JSON: the structured alert specification (layout, elements, motion). */
    spec: text('spec', { mode: 'json' }).notNull().default(sql`'{}'`),
    messageTemplate: text('message_template').notNull().default('{{username}}'),
    durationMs: integer('duration_ms').notNull().default(5000),
    soundAssetId: text('sound_asset_id').references(() => assets.id, {
      onDelete: 'set null',
    }),
    minThreshold: integer('min_threshold'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [index('alert_configs_event_type_idx').on(table.eventType)],
)

/** A connected streaming platform. Tokens are encrypted before they land here. */
export const connectedAccounts = sqliteTable(
  'connected_accounts',
  {
    id: id(),
    /** twitch | youtube */
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    providerChannelId: text('provider_channel_id'),
    displayName: text('display_name'),
    username: text('username'),
    avatarUrl: text('avatar_url'),
    /** JSON string array of granted OAuth scopes. */
    scopes: text('scopes', { mode: 'json' }).notNull().default(sql`'[]'`),
    /** Encrypted at rest — see src/lib/db/secrets.ts. Never logged, never sent to the client. */
    accessTokenEncrypted: text('access_token_encrypted'),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    tokenExpiresAt: text('token_expires_at'),
    metadata: text('metadata', { mode: 'json' }).notNull().default(sql`'{}'`),
    connectedAt: timestamp('connected_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [uniqueIndex('connected_accounts_provider_idx').on(table.provider)],
)

/** Normalized events from every provider, in one provider-neutral shape. */
export const streamEvents = sqliteTable(
  'stream_events',
  {
    id: id(),
    provider: text('provider').notNull(),
    /**
     * The provider's own event ID. Combined with `provider` this is unique, so
     * a redelivered event is rejected by the database rather than by the
     * application trying to remember what it has already seen.
     */
    providerEventId: text('provider_event_id').notNull(),
    /** Internal type, e.g. channel.follow, channel.subscribe, channel.raid */
    type: text('type').notNull(),
    actor: text('actor', { mode: 'json' }).notNull().default(sql`'{}'`),
    data: text('data', { mode: 'json' }).notNull().default(sql`'{}'`),
    /** Test events travel the real pipeline but never count in analytics. */
    isTest: integer('is_test', { mode: 'boolean' }).notNull().default(false),
    occurredAt: text('occurred_at').notNull(),
    createdAt: timestamp('created_at'),
  },
  (table) => [
    uniqueIndex('stream_events_dedupe_idx').on(table.provider, table.providerEventId),
    index('stream_events_occurred_idx').on(table.occurredAt),
    index('stream_events_type_idx').on(table.type),
  ],
)

export type Brand = typeof brands.$inferSelect
export type Asset = typeof assets.$inferSelect
export type Overlay = typeof overlays.$inferSelect
export type OverlayWidget = typeof overlayWidgets.$inferSelect
export type AlertConfig = typeof alertConfigs.$inferSelect
export type ConnectedAccount = typeof connectedAccounts.$inferSelect
export type StreamEvent = typeof streamEvents.$inferSelect
