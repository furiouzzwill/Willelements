import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, before, describe } from 'node:test'

/**
 * The money part.
 *
 * Everything asserted here is a claim about a number the person reading the
 * page will trust. The dangerous failures are not crashes — they are a total
 * that looks right and is not: an unpriced model counted as free, a package
 * quoted at the wrong size, a failed call recorded as a charge.
 */

const workspace = mkdtempSync(path.join(tmpdir(), 'we-images-'))
process.env.WILLELEMENTS_DATA_DIR = workspace

type Pricing = typeof import('../src/lib/providers/openai/pricing.ts')
type Prompt = typeof import('../src/lib/services/image-prompt.ts')
type Brand = typeof import('../src/lib/schemas/brand.ts')

let pricing: Pricing
let prompt: Prompt
let brand: Brand

before(async () => {
  pricing = await import('../src/lib/providers/openai/pricing.ts')
  prompt = await import('../src/lib/services/image-prompt.ts')
  brand = await import('../src/lib/schemas/brand.ts')
})

after(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('pricing', () => {
  test('a model with no published price estimates null, never zero', () => {
    const unpriced = pricing.MODELS.find((model) => model.price === null)
    assert.ok(unpriced, 'expected at least one model with no verifiable price')

    const estimate = pricing.estimateCost(unpriced.id, 'high', '1024x1024')
    // Zero would claim the call was free, which is a different statement from
    // "we do not know what this costs".
    assert.equal(estimate, null)
    assert.notEqual(estimate, 0)
  })

  test('rectangles cost more than squares at the same quality', () => {
    const square = pricing.estimateCost('gpt-image-1.5', 'high', '1024x1024')
    const wide = pricing.estimateCost('gpt-image-1.5', 'high', '1536x1024')

    assert.ok(square !== null && wide !== null)
    assert.ok(wide > square, 'a wide image should not be quoted at the square price')
  })

  test('quality tiers are ordered low < medium < high', () => {
    const low = pricing.estimateCost('gpt-image-1.5', 'low', '1024x1024')
    const medium = pricing.estimateCost('gpt-image-1.5', 'medium', '1024x1024')
    const high = pricing.estimateCost('gpt-image-1.5', 'high', '1024x1024')

    assert.ok(low !== null && medium !== null && high !== null)
    assert.ok(low < medium && medium < high)
  })

  test('count multiplies the estimate', () => {
    const one = pricing.estimateCost('gpt-image-1.5', 'medium', '1024x1024', 1)
    const four = pricing.estimateCost('gpt-image-1.5', 'medium', '1024x1024', 4)

    assert.ok(one !== null && four !== null)
    assert.equal(Math.round(four * 10_000), Math.round(one * 4 * 10_000))
  })

  test('an unknown model estimates null rather than throwing', () => {
    assert.equal(pricing.estimateCost('gpt-image-nonexistent', 'high', '1024x1024'), null)
  })

  test('an unknown cost formats as a dash, not as $0.00', () => {
    assert.equal(pricing.formatCost(null), '—')
    // These must never be confused: one is "free", the other is "unknown".
    assert.equal(pricing.formatCost(0), '$0.00')
  })

  test('the default model is one that is priced and not retired', () => {
    const model = pricing.findModel(pricing.DEFAULT_MODEL)
    assert.ok(model)
    assert.ok(model.price !== null, 'the default must have a verifiable price')
    assert.equal(pricing.isRetired(model), false)
  })

  test('a retirement date in the past marks a model retired', () => {
    const retiring = pricing.MODELS.find((model) => model.retiresOn)
    assert.ok(retiring, 'expected a model with an announced retirement')

    assert.equal(pricing.isRetired(retiring, new Date('2020-01-01')), false)
    assert.equal(pricing.isRetired(retiring, new Date('2099-01-01')), true)
  })
})

describe('prompts', () => {
  test('the brand palette reaches the prompt as hex', () => {
    const parsed = brand.brandDna.parse({ colors: { primary: '#123456' } })
    const subject = prompt.findSubject('logo-concept')
    assert.ok(subject)

    const text = prompt.buildPrompt({ subject, brandName: 'Test', dna: parsed })
    assert.match(text, /#123456/)
  })

  test('avoid rules are stated as things to avoid', () => {
    const parsed = brand.brandDna.parse({ rules: { avoid: ['clip art'], prefer: [] } })
    const subject = prompt.findSubject('stream-background')
    assert.ok(subject)

    const text = prompt.buildPrompt({ subject, brandName: 'Test', dna: parsed })
    assert.match(text, /Avoid entirely: clip art/)
  })

  test('extra text is appended rather than replacing the brand', () => {
    const parsed = brand.brandDna.parse({ colors: { primary: '#ABCDEF' } })
    const subject = prompt.findSubject('panel-art')
    assert.ok(subject)

    const text = prompt.buildPrompt({
      subject,
      brandName: 'Test',
      dna: parsed,
      extra: 'a fox motif',
    })

    assert.match(text, /#ABCDEF/)
    assert.match(text, /a fox motif$/)
  })

  test('the logo subject asks for transparency and no lettering', () => {
    const subject = prompt.findSubject('logo-concept')
    assert.ok(subject)

    assert.equal(subject.transparent, true)
    assert.equal(subject.assetType, 'logo')
    // Image models add text unless told not to, and a logo with invented
    // lettering is unusable.
    assert.match(subject.instruction({ name: 'Test' }), /No text/i)
  })

  test('only the logo is transparent', () => {
    const transparent = prompt.SUBJECTS.filter((subject) => subject.transparent)
    assert.deepEqual(
      transparent.map((subject) => subject.id),
      ['logo-concept'],
    )
  })

  test('every package subject exists', () => {
    for (const id of prompt.PACKAGE_SUBJECT_IDS) {
      assert.ok(prompt.findSubject(id), `package references unknown subject ${id}`)
    }
  })

  test('the package mixes sizes, so it cannot be priced at one size', () => {
    const sizes = prompt.PACKAGE_SUBJECT_IDS.map((id) => prompt.findSubject(id)?.size)
    assert.ok(new Set(sizes).size > 1, 'if this ever becomes uniform, the form may simplify')
  })
})
