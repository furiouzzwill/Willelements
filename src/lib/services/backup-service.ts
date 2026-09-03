import 'server-only'

import { mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { unzipSync, zipSync } from 'fflate'

import { ASSETS_DIR, DATA_DIR, DB_PATH, closeDb, getDb } from '@/lib/db'
import { LATEST_VERSION } from '@/lib/db/migrations'

/**
 * Backup and restore.
 *
 * The data folder is the only copy of everything, so this exists to make
 * "copy the folder" into one button. Produces a zip containing the database
 * and every asset file.
 *
 * The database is captured with SQLite's own backup API rather than by copying
 * app.db off disk. A raw copy taken while the app is running can miss data
 * still sitting in the write-ahead log, or catch a write mid-flight; the backup
 * API takes a consistent snapshot instead.
 */

const MANIFEST_NAME = 'willelements-backup.json'
const DB_ENTRY = 'app.db'
const ASSET_PREFIX = 'assets/'

type Manifest = {
  format: 1
  schemaVersion: number
  createdAt: string
  assetCount: number
}

export async function exportBackup(): Promise<{ fileName: string; bytes: Uint8Array }> {
  const staging = await mkdtemp(path.join(tmpdir(), 'willelements-backup-'))
  const snapshotPath = path.join(staging, DB_ENTRY)

  try {
    // Consistent snapshot, safe to take while the app is in use.
    await getDb().$client.backup(snapshotPath)

    const files: Record<string, Uint8Array> = {
      [DB_ENTRY]: new Uint8Array(await readFile(snapshotPath)),
    }

    const assetNames = await readdir(ASSETS_DIR).catch(() => [] as string[])
    for (const name of assetNames) {
      files[`${ASSET_PREFIX}${name}`] = new Uint8Array(
        await readFile(path.join(ASSETS_DIR, name)),
      )
    }

    const manifest: Manifest = {
      format: 1,
      schemaVersion: LATEST_VERSION,
      createdAt: new Date().toISOString(),
      assetCount: assetNames.length,
    }
    files[MANIFEST_NAME] = new TextEncoder().encode(JSON.stringify(manifest, null, 2))

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

    return {
      fileName: `willelements-backup-${stamp}.zip`,
      bytes: zipSync(files, { level: 6 }),
    }
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupError'
  }
}

/**
 * Restores a backup over the current data folder.
 *
 * Destructive and deliberate: the caller must confirm first. The current
 * database is snapshotted alongside the restored one before anything is
 * overwritten, so a restore of the wrong file is recoverable.
 */
export async function importBackup(zipBytes: Uint8Array): Promise<{ assetCount: number }> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(zipBytes)
  } catch {
    throw new BackupError('That file is not a readable zip archive.')
  }

  const manifestBytes = entries[MANIFEST_NAME]
  if (!manifestBytes) {
    throw new BackupError('That zip is not a Willelements backup.')
  }

  let manifest: Manifest
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as Manifest
  } catch {
    throw new BackupError('This backup has a damaged manifest.')
  }

  if (manifest.format !== 1) {
    throw new BackupError(`Unsupported backup format (${manifest.format}).`)
  }

  if (manifest.schemaVersion > LATEST_VERSION) {
    throw new BackupError(
      `This backup was made by a newer version of the app ` +
        `(schema ${manifest.schemaVersion}, this build understands ${LATEST_VERSION}). Update first.`,
    )
  }

  if (!entries[DB_ENTRY]) {
    throw new BackupError('This backup has no database in it.')
  }

  // Keep the current state before overwriting it.
  const rescue = path.join(DATA_DIR, `app.db.before-restore-${Date.now()}`)
  await getDb().$client.backup(rescue)

  // Close before replacing the file. An open connection holds a write-ahead log
  // belonging to the database being replaced; leaving it in place lets SQLite
  // replay those pages over the restored data and silently undo the restore.
  closeDb()

  await writeFile(DB_PATH, entries[DB_ENTRY])

  // The old WAL and shared-memory index describe the database we just replaced.
  for (const suffix of ['-wal', '-shm']) {
    await unlink(`${DB_PATH}${suffix}`).catch(() => {
      // Absent is the expected case after a clean close.
    })
  }

  let assetCount = 0
  for (const [name, bytes] of Object.entries(entries)) {
    if (!name.startsWith(ASSET_PREFIX)) continue

    // Names come from the archive, so they are untrusted: keep only the final
    // segment so a crafted entry cannot write outside the assets directory.
    const base = path.basename(name)
    if (!base || base === '.' || base === '..') continue

    await writeFile(path.join(ASSETS_DIR, base), bytes)
    assetCount += 1
  }

  return { assetCount }
}
