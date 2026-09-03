import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, before, describe } from 'node:test'

/**
 * Brand service behaviour, against a real database in a throwaway directory.
 */

const workspace = mkdtempSync(path.join(tmpdir(), 'we-brand-'))
process.env.WILLELEMENTS_DATA_DIR = workspace

type BrandModule = typeof import('../src/lib/services/brand-service.ts')
type SetupModule = typeof import('../src/lib/services/setup-service.ts')

let brands: BrandModule
let setup: SetupModule

before(async () => {
  brands = await import('../src/lib/services/brand-service.ts')
  setup = await import('../src/lib/services/setup-service.ts')
})

after(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('first run', () => {
  test('seeds exactly one brand, with complete DNA', () => {
    const all = brands.listBrands()

    assert.equal(all.length, 1, 'a starter brand is created on first open')
    assert.equal(all[0].name, 'My Brand')
    assert.equal(all[0].isDefault, true)
    assert.equal(all[0].dna.colors.primary, '#A855F7', 'DNA is fully defaulted, not empty')
    assert.equal(all[0].dna.typography.heading, 'Space Grotesk')
  })

  test('reports that onboarding is still needed', () => {
    assert.equal(setup.needsOnboarding(), true)
    assert.equal(setup.getSetupState().hasNamedBrand, false)
  })
})

describe('updating a brand', () => {
  test('a partial update leaves untouched fields alone', () => {
    const brand = brands.getDefaultBrand()!
    const updated = brands.updateBrand(brand.id, { name: 'NightShift Gaming' })

    assert.equal(updated.name, 'NightShift Gaming')
    assert.equal(
      updated.dna.colors.primary,
      brand.dna.colors.primary,
      'DNA survives an identity-only update',
    )
  })

  test('renaming away from the starter name completes onboarding', () => {
    assert.equal(setup.needsOnboarding(), false)
    assert.equal(setup.getSetupState().hasNamedBrand, true)
  })

  test('a DNA update merges rather than replacing the whole object', () => {
    const brand = brands.getDefaultBrand()!
    const updated = brands.updateBrand(brand.id, {
      dna: { ...brand.dna, colors: { ...brand.dna.colors, primary: '#112233' } },
    })

    assert.equal(updated.dna.colors.primary, '#112233')
    assert.equal(
      updated.dna.typography.heading,
      'Space Grotesk',
      'unrelated DNA sections are preserved',
    )
  })

  test('rejects an invalid colour rather than storing it', () => {
    const brand = brands.getDefaultBrand()!
    assert.throws(() =>
      brands.updateBrand(brand.id, {
        dna: { ...brand.dna, colors: { ...brand.dna.colors, primary: 'chartreuse' } as never },
      }),
    )

    assert.equal(
      brands.getDefaultBrand()!.dna.colors.primary,
      '#112233',
      'the stored value is unchanged after a rejected write',
    )
  })

  test('rejects an empty name', () => {
    const brand = brands.getDefaultBrand()!
    assert.throws(() => brands.updateBrand(brand.id, { name: '   ' }))
  })
})

describe('defaults', () => {
  test('a second brand does not steal the default flag', () => {
    const second = brands.createBrand({
      name: 'Side Project',
      creatorType: 'youtuber',
      dna: {} as never,
    })

    assert.equal(second.isDefault, false)
    assert.equal(brands.getDefaultBrand()!.name, 'NightShift Gaming')
  })

  test('setting a new default clears the old one', () => {
    const side = brands.listBrands().find((brand) => brand.name === 'Side Project')!
    brands.setDefaultBrand(side.id)

    const defaults = brands.listBrands().filter((brand) => brand.isDefault)
    assert.equal(defaults.length, 1, 'exactly one brand is ever the default')
    assert.equal(defaults[0].name, 'Side Project')
  })
})
