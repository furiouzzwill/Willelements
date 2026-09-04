import 'server-only'

import type Database from 'better-sqlite3'

/**
 * Migrations, applied in order and tracked by SQLite's own `user_version`.
 *
 * Deliberately hand-written rather than generated. A local single-user app does
 * not need a migration CLI, and dropping that tooling removed a dependency
 * (and its advisories) from the project entirely.
 *
 * Rules:
 *  - Append only. Never edit a migration that has shipped — add another.
 *  - Each entry runs inside a transaction; a failure rolls back cleanly.
 */
const migrations: { name: string; sql: string }[] = [
  {
    name: '001_initial',
    sql: `
      CREATE TABLE brands (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        audience TEXT,
        creator_type TEXT,
        dna TEXT NOT NULL DEFAULT '{}',
        logo_asset_id TEXT,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE assets (
        id TEXT PRIMARY KEY,
        brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER,
        width INTEGER,
        height INTEGER,
        duration_ms INTEGER,
        prompt TEXT,
        provider TEXT,
        model TEXT,
        approved INTEGER NOT NULL DEFAULT 0,
        favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX assets_type_idx ON assets(type);

      CREATE TABLE overlays (
        id TEXT PRIMARY KEY,
        brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        canvas_width INTEGER NOT NULL DEFAULT 1920,
        canvas_height INTEGER NOT NULL DEFAULT 1080,
        settings TEXT NOT NULL DEFAULT '{}',
        public_token TEXT NOT NULL,
        token_rotated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE UNIQUE INDEX overlays_public_token_idx ON overlays(public_token);

      CREATE TABLE overlay_widgets (
        id TEXT PRIMARY KEY,
        overlay_id TEXT NOT NULL REFERENCES overlays(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        config TEXT NOT NULL DEFAULT '{}',
        x INTEGER NOT NULL DEFAULT 0,
        y INTEGER NOT NULL DEFAULT 0,
        width INTEGER NOT NULL DEFAULT 400,
        height INTEGER NOT NULL DEFAULT 200,
        z_index INTEGER NOT NULL DEFAULT 0,
        locked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX overlay_widgets_overlay_idx ON overlay_widgets(overlay_id);

      CREATE TABLE alert_configs (
        id TEXT PRIMARY KEY,
        brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        spec TEXT NOT NULL DEFAULT '{}',
        message_template TEXT NOT NULL DEFAULT '{{username}}',
        duration_ms INTEGER NOT NULL DEFAULT 5000,
        sound_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
        min_threshold INTEGER,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX alert_configs_event_type_idx ON alert_configs(event_type);

      CREATE TABLE connected_accounts (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_user_id TEXT NOT NULL,
        provider_channel_id TEXT,
        display_name TEXT,
        username TEXT,
        avatar_url TEXT,
        scopes TEXT NOT NULL DEFAULT '[]',
        access_token_encrypted TEXT,
        refresh_token_encrypted TEXT,
        token_expires_at TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        connected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE UNIQUE INDEX connected_accounts_provider_idx ON connected_accounts(provider);

      CREATE TABLE stream_events (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_event_id TEXT NOT NULL,
        type TEXT NOT NULL,
        actor TEXT NOT NULL DEFAULT '{}',
        data TEXT NOT NULL DEFAULT '{}',
        is_test INTEGER NOT NULL DEFAULT 0,
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE UNIQUE INDEX stream_events_dedupe_idx ON stream_events(provider, provider_event_id);
      CREATE INDEX stream_events_occurred_idx ON stream_events(occurred_at);
      CREATE INDEX stream_events_type_idx ON stream_events(type);
    `,
  },
  {
    name: '002_render_jobs',
    sql: `
      CREATE TABLE render_jobs (
        id TEXT PRIMARY KEY,
        brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
        template_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        quality TEXT NOT NULL DEFAULT 'standard',
        format TEXT NOT NULL DEFAULT 'mp4',
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        input TEXT NOT NULL DEFAULT '{}',
        -- Relative to the data directory, so the folder stays portable.
        project_dir TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        stage TEXT,
        output_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        started_at TEXT,
        completed_at TEXT
      );
      CREATE INDEX render_jobs_status_idx ON render_jobs(status);
      CREATE INDEX render_jobs_created_idx ON render_jobs(created_at);
    `,
  },
]

/**
 * Applies any migrations the database has not seen.
 *
 * Safe to call repeatedly, and safe to call from several processes at once —
 * `next build` runs multiple workers, and each one opens the database. Each
 * migration takes the write lock with BEGIN IMMEDIATE and then re-reads
 * `user_version` inside that lock, so a migration another process applied while
 * we were waiting is skipped rather than run twice.
 */
export function migrate(db: Database.Database): { applied: string[] } {
  const applied: string[] = []

  for (let index = 0; index < migrations.length; index++) {
    const migration = migrations[index]

    const run = db.transaction(() => {
      const version = db.pragma('user_version', { simple: true }) as number
      if (version > index) return false

      db.exec(migration.sql)
      // pragma values cannot be bound as parameters.
      db.pragma(`user_version = ${index + 1}`)
      return true
    })

    if (run.immediate()) applied.push(migration.name)
  }

  return { applied }
}

export const LATEST_VERSION = migrations.length
