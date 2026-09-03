import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { desc, eq } from 'drizzle-orm'

import { ASSETS_DIR, getDb } from '@/lib/db'
import { assets, type Asset } from '@/lib/db/schema'
import { clearLogoReferences } from '@/lib/services/brand-service'

/**
 * Asset storage.
 *
 * Bytes go to `data/assets`, metadata to the database. The two are kept in step
 * by writing the file first and the row second: an orphaned file wastes disk,
 * whereas a row pointing at a missing file breaks the UI.
 *
 * A local app still validates uploads. Not because the user is an attacker, but
 * because a file that is not what its name claims will fail confusingly three
 * phases later — in an overlay, live, rather than here.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB

/**
 * Accepted types, keyed by the magic bytes that actually identify them.
 *
 * The declared Content-Type and the file extension are both trivially wrong or
 * spoofed, so neither is trusted: the signature decides, and a mismatch is
 * rejected.
 */
const SIGNATURES: {
  mime: string
  extension: string
  kind: AssetKind
  test: (bytes: Uint8Array) => boolean
}[] = [
  {
    mime: 'image/png',
    extension: 'png',
    kind: 'image',
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: 'image/jpeg',
    extension: 'jpg',
    kind: 'image',
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/gif',
    extension: 'gif',
    kind: 'image',
    test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  },
  {
    mime: 'image/webp',
    extension: 'webp',
    kind: 'image',
    // "RIFF" .... "WEBP"
    test: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    mime: 'video/mp4',
    extension: 'mp4',
    kind: 'video',
    // "ftyp" box at offset 4
    test: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70,
  },
  {
    mime: 'video/webm',
    extension: 'webm',
    kind: 'video',
    test: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  },
  {
    mime: 'audio/mpeg',
    extension: 'mp3',
    kind: 'sound',
    // ID3 tag, or an MPEG frame sync
    test: (b) =>
      (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  },
  {
    mime: 'audio/wav',
    extension: 'wav',
    kind: 'sound',
    // "RIFF" .... "WAVE"
    test: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x41 &&
      b[10] === 0x56 &&
      b[11] === 0x45,
  },
]

export type AssetKind = 'image' | 'video' | 'sound'

/** Thrown for input problems worth showing the user, rather than logging. */
export class AssetValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssetValidationError'
  }
}

export type DetectedType = { mime: string; extension: string; kind: AssetKind }

/** Identifies a file by its content. Returns null for anything unrecognised. */
export function detectType(bytes: Uint8Array): DetectedType | null {
  if (bytes.length < 12) return null
  const match = SIGNATURES.find((signature) => signature.test(bytes))
  return match ? { mime: match.mime, extension: match.extension, kind: match.kind } : null
}

export const ACCEPTED_MIME_TYPES = [...new Set(SIGNATURES.map((s) => s.mime))]

export type SaveAssetInput = {
  bytes: Uint8Array
  /** Stored as `type` — the role this asset plays, not its file format. */
  type: 'logo' | 'image' | 'background' | 'animation' | 'video' | 'sound'
  brandId?: string | null
  source?: 'upload' | 'generated'
  prompt?: string | null
  provider?: string | null
  model?: string | null
}

/**
 * Validates and stores a file, then records it.
 *
 * The filename is generated, never taken from the upload — a name is untrusted
 * input, and path traversal through it is the one way a local app can still be
 * made to write outside its own directory.
 */
export async function saveAsset(input: SaveAssetInput): Promise<Asset> {
  const { bytes } = input

  if (bytes.length === 0) {
    throw new AssetValidationError('That file is empty.')
  }

  if (bytes.length > MAX_UPLOAD_BYTES) {
    const limit = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))
    throw new AssetValidationError(`Files must be under ${limit} MB.`)
  }

  const detected = detectType(bytes)
  if (!detected) {
    throw new AssetValidationError(
      'That file type is not supported. Use PNG, JPEG, GIF, WebP, MP4, WebM, MP3 or WAV.',
    )
  }

  // Content-addressed name: identical uploads land on one file, and nothing
  // from the original filename reaches the filesystem.
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 32)
  const fileName = `${digest}.${detected.extension}`
  const absolutePath = path.join(ASSETS_DIR, fileName)

  // Don't rely on the database module having created this. It is idempotent,
  // and it means an upload still works if the folder was removed by hand or
  // lost in a partial restore.
  await mkdir(ASSETS_DIR, { recursive: true })
  await writeFile(absolutePath, bytes)

  const row = getDb()
    .insert(assets)
    .values({
      id: randomUUID(),
      brandId: input.brandId ?? null,
      type: input.type,
      source: input.source ?? 'upload',
      // Relative, so the data folder stays portable between machines.
      filePath: fileName,
      mimeType: detected.mime,
      fileSize: bytes.length,
      prompt: input.prompt ?? null,
      provider: input.provider ?? null,
      model: input.model ?? null,
    })
    .returning()
    .get()

  return row
}

export function getAsset(id: string): Asset | null {
  return getDb().select().from(assets).where(eq(assets.id, id)).get() ?? null
}

export function listAssets(type?: string): Asset[] {
  const db = getDb()
  const query = db.select().from(assets).orderBy(desc(assets.createdAt))
  return type ? query.where(eq(assets.type, type)).all() : query.all()
}

/** Absolute path for an asset's bytes. */
export function assetPath(asset: Asset): string {
  return path.join(ASSETS_DIR, asset.filePath)
}

/**
 * Deletes the row, and the file if nothing else references it.
 *
 * Content-addressed names mean two assets can legitimately share one file, so
 * the file only goes when the last row using it does.
 */
export async function deleteAsset(id: string): Promise<void> {
  const db = getDb()
  const asset = getAsset(id)
  if (!asset) return

  // A brand pointing at this asset would otherwise render a broken logo.
  clearLogoReferences(id)
  db.delete(assets).where(eq(assets.id, id)).run()

  const stillUsed = db
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.filePath, asset.filePath))
    .limit(1)
    .get()

  if (!stillUsed) {
    await unlink(path.join(ASSETS_DIR, asset.filePath)).catch(() => {
      // Already gone — the row is what mattered.
    })
  }
}
