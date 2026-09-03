import 'server-only'

import { eq, ne } from 'drizzle-orm'

import { getDb } from '@/lib/db'
import { readJson, writeJson } from '@/lib/db/json'
import { brands, type Brand } from '@/lib/db/schema'
import { brandDna, brandInput, type BrandDna, type BrandInput } from '@/lib/schemas/brand'

/**
 * Brand DNA reads and writes.
 *
 * Synchronous throughout: better-sqlite3 talks to a local file, so there is no
 * IO to await and Server Components can call these directly.
 *
 * Callers get `BrandWithDna`, never the raw row — the `dna` column is parsed
 * once here so nothing downstream handles unvalidated JSON.
 */

export type BrandWithDna = Omit<Brand, 'dna'> & { dna: BrandDna }

function hydrate(row: Brand): BrandWithDna {
  return {
    ...row,
    dna: readJson(brandDna, row.dna, `brands.dna (${row.id})`),
  }
}

function now(): string {
  return new Date().toISOString()
}

export function listBrands(): BrandWithDna[] {
  return getDb().select().from(brands).all().map(hydrate)
}

export function getBrand(id: string): BrandWithDna | null {
  const row = getDb().select().from(brands).where(eq(brands.id, id)).get()
  return row ? hydrate(row) : null
}

/** The brand everything defaults to. Null only if no brand exists at all. */
export function getDefaultBrand(): BrandWithDna | null {
  const db = getDb()

  const explicit = db.select().from(brands).where(eq(brands.isDefault, true)).limit(1).get()
  if (explicit) return hydrate(explicit)

  // No brand is flagged default — fall back to the first one, if any.
  const first = db.select().from(brands).limit(1).get()
  return first ? hydrate(first) : null
}

export function createBrand(input: BrandInput): BrandWithDna {
  const parsed = brandInput.parse(input)
  const db = getDb()

  // The first brand created becomes the default.
  const isFirst = db.select().from(brands).limit(1).get() === undefined

  const row = db
    .insert(brands)
    .values({
      name: parsed.name,
      description: parsed.description ?? null,
      audience: parsed.audience ?? null,
      creatorType: parsed.creatorType,
      dna: writeJson(brandDna, parsed.dna),
      isDefault: isFirst,
    })
    .returning()
    .get()

  return hydrate(row)
}

export function updateBrand(id: string, input: Partial<BrandInput>): BrandWithDna {
  const existing = getBrand(id)
  if (!existing) throw new Error(`No brand with id ${id}`)

  // Re-validate the merged result rather than the patch, so a partial update
  // cannot leave the stored DNA in a shape the schema would reject.
  const merged = brandInput.parse({
    name: input.name ?? existing.name,
    description: input.description !== undefined ? input.description : existing.description,
    audience: input.audience !== undefined ? input.audience : existing.audience,
    creatorType: input.creatorType ?? existing.creatorType ?? 'streamer',
    dna: input.dna ? { ...existing.dna, ...input.dna } : existing.dna,
  })

  const row = getDb()
    .update(brands)
    .set({
      name: merged.name,
      description: merged.description ?? null,
      audience: merged.audience ?? null,
      creatorType: merged.creatorType,
      dna: writeJson(brandDna, merged.dna),
      updatedAt: now(),
    })
    .where(eq(brands.id, id))
    .returning()
    .get()

  return hydrate(row)
}

/** Makes one brand the default and clears the flag on every other. */
export function setDefaultBrand(id: string): void {
  getDb().transaction((tx) => {
    tx.update(brands).set({ isDefault: false }).where(ne(brands.id, id)).run()
    tx.update(brands).set({ isDefault: true, updatedAt: now() }).where(eq(brands.id, id)).run()
  })
}

export function deleteBrand(id: string): void {
  getDb().delete(brands).where(eq(brands.id, id)).run()
}

/** Sets which asset is this brand's logo. Pass null to clear it. */
export function setBrandLogo(brandId: string, assetId: string | null): void {
  getDb()
    .update(brands)
    .set({ logoAssetId: assetId, updatedAt: now() })
    .where(eq(brands.id, brandId))
    .run()
}

/**
 * Clears the logo reference from any brand pointing at this asset.
 *
 * `brands.logo_asset_id` is deliberately not a foreign key — a brand should
 * survive its logo being deleted — so nothing in the database does this for us.
 */
export function clearLogoReferences(assetId: string): void {
  getDb()
    .update(brands)
    .set({ logoAssetId: null, updatedAt: now() })
    .where(eq(brands.logoAssetId, assetId))
    .run()
}

/**
 * Creates a starter brand the first time the app runs.
 *
 * An empty app is a worse first impression than a placeholder one, and every
 * downstream phase can assume a brand exists. Returns null if one already does.
 */
export function seedDefaultBrandIfEmpty(): BrandWithDna | null {
  if (getDb().select().from(brands).limit(1).get() !== undefined) return null

  return createBrand({
    name: 'My Brand',
    description: null,
    audience: null,
    creatorType: 'streamer',
    dna: brandDna.parse({}),
  })
}
