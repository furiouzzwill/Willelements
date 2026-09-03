import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, before, describe } from 'node:test'

/**
 * Backup round-trip.
 *
 * The data folder is the only copy of everything, so this is the test that
 * matters most: if export/import is subtly wrong, the failure surfaces on the
 * day someone actually needs a restore.
 *
 * The data directory is redirected before importing anything that opens the
 * database, so this never touches a real install.
 */

const workspace = mkdtempSync(path.join(tmpdir(), 'we-backup-'))
process.env.WILLELEMENTS_DATA_DIR = workspace

type BackupModule = typeof import('../src/lib/services/backup-service.ts')
type AssetModule = typeof import('../src/lib/services/asset-service.ts')

let backup: BackupModule
let assetService: AssetModule

before(async () => {
  backup = await import('../src/lib/services/backup-service.ts')
  assetService = await import('../src/lib/services/asset-service.ts')
})

after(() => {
  rmSync(workspace, { recursive: true, force: true })
})

const PNG_BYTES = (() => {
  const buffer = new Uint8Array(64)
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  buffer.set([1, 2, 3, 4], 16)
  return buffer
})()

describe('backup export', () => {
  test('produces a zip containing the database, assets and a manifest', async () => {
    const { createBrand } = await import('../src/lib/services/brand-service.ts')
    createBrand({ name: 'Backup Test Brand', creatorType: 'streamer', dna: {} as never })
    await assetService.saveAsset({ bytes: PNG_BYTES, type: 'logo' })

    const { fileName, bytes } = await backup.exportBackup()

    assert.match(fileName, /^willelements-backup-.*\.zip$/)
    assert.ok(bytes.byteLength > 0)

    const { unzipSync } = await import('fflate')
    const entries = unzipSync(bytes)

    assert.ok(entries['app.db'], 'the database is included')
    assert.ok(entries['willelements-backup.json'], 'a manifest is included')

    const assetEntries = Object.keys(entries).filter((name) => name.startsWith('assets/'))
    assert.equal(assetEntries.length, 1, 'the asset file is included')

    const manifest = JSON.parse(new TextDecoder().decode(entries['willelements-backup.json']))
    assert.equal(manifest.format, 1)
    assert.equal(manifest.assetCount, 1)
  })

  test('the exported database is a readable snapshot, not a truncated copy', async () => {
    // A raw file copy taken while WAL is active can miss committed rows. This
    // asserts the snapshot actually contains what was written.
    const { bytes } = await backup.exportBackup()
    const { unzipSync } = await import('fflate')
    const entries = unzipSync(bytes)

    const extracted = path.join(workspace, 'extracted.db')
    writeFileSync(extracted, entries['app.db'])

    const Database = (await import('better-sqlite3')).default
    const snapshot = new Database(extracted, { readonly: true })
    const brands = snapshot.prepare('SELECT name FROM brands').all() as { name: string }[]

    assert.ok(
      brands.some((row) => row.name === 'Backup Test Brand'),
      'the brand written before export is present in the snapshot',
    )
    snapshot.close()
  })
})

describe('backup import', () => {
  test('rejects a file that is not a zip', async () => {
    await assert.rejects(
      () => backup.importBackup(new TextEncoder().encode('definitely not a zip')),
      /not a readable zip/,
    )
  })

  test('rejects a zip that is not one of ours', async () => {
    const { zipSync } = await import('fflate')
    const foreign = zipSync({ 'notes.txt': new TextEncoder().encode('hello') })

    await assert.rejects(() => backup.importBackup(foreign), /not a Willelements backup/)
  })

  test('refuses a backup from a newer schema than this build understands', async () => {
    const { zipSync } = await import('fflate')
    const archive = zipSync({
      'willelements-backup.json': new TextEncoder().encode(
        JSON.stringify({ format: 1, schemaVersion: 999, createdAt: '', assetCount: 0 }),
      ),
      'app.db': new Uint8Array([1, 2, 3]),
    })

    await assert.rejects(() => backup.importBackup(archive), /newer version/)
  })

  test('restores content and keeps the previous database beside it', async () => {
    const { listBrands, createBrand } = await import('../src/lib/services/brand-service.ts')

    const exported = await backup.exportBackup()

    // Change state after the export, so a successful restore is observable.
    createBrand({ name: 'Added After Export', creatorType: 'streamer', dna: {} as never })
    assert.ok(listBrands().some((brand) => brand.name === 'Added After Export'))

    const { assetCount } = await backup.importBackup(exported.bytes)
    assert.equal(assetCount, 1)

    // The file on disk is the restored one. The live connection still points at
    // the replaced file, which is why the app asks for a restart — verify the
    // bytes rather than the open handle.
    const Database = (await import('better-sqlite3')).default
    const restored = new Database(path.join(workspace, 'app.db'), { readonly: true })
    const names = (restored.prepare('SELECT name FROM brands').all() as { name: string }[]).map(
      (row) => row.name,
    )
    restored.close()

    assert.ok(names.includes('Backup Test Brand'))
    assert.ok(
      !names.includes('Added After Export'),
      'the restore replaced the newer state, as documented',
    )

    const rescueFiles = (await import('node:fs')).readdirSync(workspace)
    assert.ok(
      rescueFiles.some((name) => name.startsWith('app.db.before-restore-')),
      'the pre-restore database was kept',
    )
  })

  test('an archive entry cannot write outside the assets directory', async () => {
    const { zipSync } = await import('fflate')
    const archive = zipSync({
      'willelements-backup.json': new TextEncoder().encode(
        JSON.stringify({ format: 1, schemaVersion: 1, createdAt: '', assetCount: 1 }),
      ),
      'app.db': readFileSync(path.join(workspace, 'app.db')),
      'assets/../../escaped.txt': new TextEncoder().encode('should not escape'),
    })

    await backup.importBackup(archive)

    const parent = path.dirname(workspace)
    assert.equal(
      (await import('node:fs')).existsSync(path.join(parent, 'escaped.txt')),
      false,
      'a traversal path in the archive must not write outside the data folder',
    )
  })
})
