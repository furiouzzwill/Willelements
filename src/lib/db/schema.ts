import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  real,
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

/**
 * One HyperFrames render, from queued to a file on disk.
 *
 * Rendering is minutes of CPU, so it never happens inside a request. A row here
 * is the whole of what the UI knows about a render in flight, and the only
 * thing that survives the process restarting mid-render.
 */
export const renderJobs = sqliteTable(
  'render_jobs',
  {
    id: id(),
    brandId: text('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    /** Must match a template in the composition registry. */
    templateId: text('template_id').notNull(),
    name: text('name').notNull(),
    /** queued | processing | completed | failed | cancelled */
    status: text('status').notNull().default('queued'),
    /** draft | standard | high */
    quality: text('quality').notNull().default('standard'),
    /** mp4 | webm — webm is what carries transparency. */
    format: text('format').notNull().default('mp4'),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    durationMs: integer('duration_ms').notNull(),
    /** JSON: the headline and subhead this render was made with. */
    input: text('input', { mode: 'json' }).notNull().default(sql`'{}'`),
    /**
     * The generated project, relative to the data directory.
     *
     * Kept after the render finishes. When a video comes out wrong, the HTML
     * that produced it is the only thing that explains why, and it is a few
     * kilobytes. Backups deliberately exclude it — the finished video is an
     * asset and is backed up; the working directory is reproducible.
     */
    projectDir: text('project_dir').notNull(),
    /** 0-100, parsed from the CLI's own progress output. */
    progress: integer('progress').notNull().default(0),
    /** What the renderer says it is doing, shown as-is. */
    stage: text('stage'),
    outputAssetId: text('output_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    error: text('error'),
    createdAt: timestamp('created_at'),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
  },
  (table) => [
    index('render_jobs_status_idx').on(table.status),
    index('render_jobs_created_idx').on(table.createdAt),
  ],
)

/**
 * One paid call to an image provider.
 *
 * Deliberately not folded into `assets`: a refused prompt costs nothing and
 * produces no asset, and deleting a generated picture must not erase the record
 * that it was paid for. The spend counter reads this table, so it survives any
 * amount of tidying in the asset library.
 */
export const imageGenerations = sqliteTable(
  'image_generations',
  {
    id: id(),
    brandId: text('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    /** Which of the fixed subjects this was — logo concept, background, and so on. */
    subject: text('subject').notNull(),
    provider: text('provider').notNull().default('openai'),
    model: text('model').notNull(),
    quality: text('quality').notNull(),
    size: text('size').notNull(),
    /** Stored verbatim, so a result you liked can be reproduced. */
    prompt: text('prompt').notNull(),
    /**
     * Estimated dollars, from a published price list read on a date — not a
     * figure the provider gave us for this account. Null where no verifiable
     * price exists, which is different from zero.
     */
    costEstimate: real('cost_estimate'),
    status: text('status').notNull().default('succeeded'),
    error: text('error'),
    assetId: text('asset_id').references(() => assets.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at'),
  },
  (table) => [
    index('image_generations_created_idx').on(table.createdAt),
    index('image_generations_status_idx').on(table.status),
  ],
)

/**
 * One structured generation — a description in, a validated specification out.
 *
 * Separate from `image_generations` because the unit of cost is tokens rather
 * than images, and because what it produces is a spec the app applies rather
 * than a file it stores. The result is kept so a design can be re-applied
 * without paying to generate it again.
 */
export const aiCommands = sqliteTable(
  'ai_commands',
  {
    id: id(),
    brandId: text('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    /** What was being designed, e.g. `alert-design`. */
    kind: text('kind').notNull(),
    /** What it was for, e.g. `channel.follow`. */
    target: text('target'),
    model: text('model').notNull(),
    prompt: text('prompt').notNull(),
    /** The validated specification. Null on a failed command. */
    result: text('result', { mode: 'json' }),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    /** Null where the provider reported no usage — distinct from zero. */
    costEstimate: real('cost_estimate'),
    status: text('status').notNull().default('succeeded'),
    error: text('error'),
    createdAt: timestamp('created_at'),
  },
  (table) => [
    index('ai_commands_created_idx').on(table.createdAt),
    index('ai_commands_kind_idx').on(table.kind),
  ],
)

export type Brand = typeof brands.$inferSelect
export type Asset = typeof assets.$inferSelect
export type Overlay = typeof overlays.$inferSelect
export type OverlayWidget = typeof overlayWidgets.$inferSelect
export type AlertConfig = typeof alertConfigs.$inferSelect
export type ConnectedAccount = typeof connectedAccounts.$inferSelect
export type StreamEvent = typeof streamEvents.$inferSelect
export type RenderJob = typeof renderJobs.$inferSelect
export type ImageGeneration = typeof imageGenerations.$inferSelect
export type AiCommand = typeof aiCommands.$inferSelect
