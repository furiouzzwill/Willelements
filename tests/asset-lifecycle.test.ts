import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, before, describe } from 'node:test'

/** Asset storage and its interaction with brands, against a real database. */

const workspace = mkdtempSync(path.join(tmpdir(), 'we-assets-'))
process.env.WILLELEMENTS_DATA_DIR = workspace

type AssetModule = typeof import('../src/lib/services/asset-service.ts')
type BrandModule = typeof import('../src/lib/services/brand-service.ts')

let assetService: AssetModule
let brandService: BrandModule

before(async () => {
  assetService = await import('../src/lib/services/asset-service.ts')
  brandService = await import('../src/lib/services/brand-service.ts')
})

after(() => {
  rmSync(workspace, { recursive: true, force: true })
})

function png(marker: number): Uint8Array {
  const bytes = new Uint8Array(64)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes[32] = marker
  return bytes
}

describe('saving assets', () => {
  test('stores the file and records the detected type', async () => {
    const asset = await assetService.saveAsset({ bytes: png(1), type: 'logo' })

    assert.equal(asset.mimeType, 'image/png')
    assert.equal(asset.fileSize, 64)
    assert.match(asset.filePath, /^[0-9a-f]{32}\.png$/, 'the name is generated, not supplied')
    assert.ok(existsSync(path.join(workspace, 'assets', asset.filePath)))
  })

  test('identical uploads share one file on disk', async () => {
    const first = await assetService.saveAsset({ bytes: png(7), type: 'image' })
    const second = await assetService.saveAsset({ bytes: png(7), type: 'image' })

    assert.notEqual(first.id, second.id, 'they are separate library entries')
    assert.equal(first.filePath, second.filePath, 'but the bytes are stored once')
  })

  test('rejects an unsupported file and writes nothing', async () => {
    const before = assetService.listAssets().length

    await assert.rejects(
      () => assetService.saveAsset({ bytes: new TextEncoder().encode('not an image at all'), type: 'image' }),
      /not supported/,
    )

    assert.equal(assetService.listAssets().length, before, 'no row was created')
  })

  test('rejects a file over the size limit', async () => {
    const huge = new Uint8Array(assetService.MAX_UPLOAD_BYTES + 1)
    huge.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)

    await assert.rejects(() => assetService.saveAsset({ bytes: huge, type: 'image' }), /under 25 MB/)
  })
})

describe('deleting assets', () => {
  test('keeps the file while another row still references it', async () => {
    const first = await assetService.saveAsset({ bytes: png(9), type: 'image' })
    const second = await assetService.saveAsset({ bytes: png(9), type: 'image' })
    const filePath = path.join(workspace, 'assets', first.filePath)

    await assetService.deleteAsset(first.id)

    assert.equal(assetService.getAsset(first.id), null, 'the row is gone')
    assert.ok(existsSync(filePath), 'the file stays while the second row needs it')

    await assetService.deleteAsset(second.id)
    assert.equal(existsSync(filePath), false, 'and goes with the last reference')
  })

  test('a deleted logo is cleared from the brand that used it', async () => {
    const brand = brandService.getDefaultBrand()!
    const logo = await assetService.saveAsset({ bytes: png(21), type: 'logo', brandId: brand.id })

    brandService.setBrandLogo(brand.id, logo.id)
    assert.equal(brandService.getDefaultBrand()!.logoAssetId, logo.id)

    await assetService.deleteAsset(logo.id)

    assert.equal(
      brandService.getDefaultBrand()!.logoAssetId,
      null,
      'the brand must not be left pointing at a logo that no longer exists',
    )
  })

  test('deleting an asset that is already gone is harmless', async () => {
    await assetService.deleteAsset('no-such-asset')
  })
})
