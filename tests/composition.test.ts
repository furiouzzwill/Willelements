import assert from 'node:assert/strict'
import test, { before, describe } from 'node:test'

/**
 * Generated compositions, and what keeps them contained.
 *
 * This is the one place in the project where a model writes code that runs, on
 * the owner's explicit instruction. The safety story is therefore not "the
 * schema is narrow" — it is the sandbox, the policy inside the frame, and the
 * escaping of anything that comes from a viewer. Those are what these tests are
 * for; a regression in any of them is the difference between an isolated frame
 * and someone's dashboard.
 */

type Schema = typeof import('../src/lib/schemas/composition.ts')
type Frame = typeof import('../src/lib/composition/frame-document.ts')
type Brand = typeof import('../src/lib/schemas/brand.ts')

let schema: Schema
let frame: Frame
let brand: Brand

before(async () => {
  schema = await import('../src/lib/schemas/composition.ts')
  frame = await import('../src/lib/composition/frame-document.ts')
  brand = await import('../src/lib/schemas/brand.ts')
})

const VALUES = {
  username: 'SynthFox',
  amount: '150',
  message: 'lets go',
  label: 'INCOMING RAID',
}

function build(html: string, values = VALUES) {
  return frame.buildFrameDocument(
    schema.composition.parse({ html, summary: '', durationMs: 3000 }),
    brand.brandDna.parse({}),
    values,
    null,
  )
}

describe('the screen', () => {
  test('rejects anything that reaches the network', () => {
    for (const source of [
      '<script>fetch("https://x.test")</script>',
      '<script>new XMLHttpRequest()</script>',
      '<script>new WebSocket("wss://x.test")</script>',
      '<script>navigator.sendBeacon("/x")</script>',
      '<img src="https://x.test/a.png">',
    ]) {
      assert.ok(
        schema.screenComposition(source).length > 0,
        `should have been rejected: ${source}`,
      )
    }
  })

  test('rejects anything that reaches out of the frame', () => {
    for (const source of [
      '<script>window.parent.document.title = "x"</script>',
      '<script>window.top.location = "/"</script>',
      '<script>window.opener.close()</script>',
      '<script>document.cookie</script>',
      '<script>localStorage.setItem("a","b")</script>',
    ]) {
      assert.ok(schema.screenComposition(source).length > 0, `should have been rejected: ${source}`)
    }
  })

  test('rejects loops that would never end', () => {
    // A composition that pins a core is worse than one that looks wrong: it is
    // running on the machine encoding someone's stream.
    assert.ok(schema.screenComposition('<script>while(true){}</script>').length > 0)
    assert.ok(schema.screenComposition('<script>for(;;){}</script>').length > 0)
  })

  test('allows an ordinary animated composition', () => {
    const ok = `<style>@keyframes a { to { opacity: 1 } }</style>
      <div style="animation: a 1s">{{username}}</div>
      <script>requestAnimationFrame(() => {})</script>`

    assert.deepEqual(schema.screenComposition(ok), [])
  })
})

describe('the frame document', () => {
  test('carries a policy that permits no network at all', () => {
    const doc = build('<div>hi</div>')

    assert.match(doc, /Content-Security-Policy/)
    assert.match(doc, /default-src 'none'/)
    // If any of these ever gain a remote source, the sandbox is the only thing
    // left, and defence in depth is the whole point of having both.
    assert.equal(/connect-src[^;]*https?:/.test(doc), false)
    assert.equal(/script-src[^;]*https?:/.test(doc), false)
  })

  test('substitutes live values', () => {
    const doc = build('<h1>{{username}}</h1><p>{{amount}} · {{label}}</p>')

    assert.match(doc, /<h1>SynthFox<\/h1>/)
    assert.match(doc, /150 · INCOMING RAID/)
  })

  test('escapes a viewer name that looks like markup', () => {
    // The name comes from whoever followed. A viewer called
    // `<script>…</script>` must be a funny name, not an event.
    const doc = build('<h1>{{username}}</h1>', {
      ...VALUES,
      username: '<script>alert(1)</script>',
    })

    assert.equal(doc.includes('<script>alert(1)</script>'), false)
    assert.match(doc, /&lt;script&gt;/)
  })

  test('escapes a message that tries to close an attribute', () => {
    const doc = build('<div title="{{message}}"></div>', {
      ...VALUES,
      message: '" onmouseover="alert(1)',
    })

    assert.equal(doc.includes('onmouseover="alert(1)"'), false)
    assert.match(doc, /&quot;/)
  })

  test('an absent logo substitutes to nothing rather than to undefined', () => {
    const doc = build('<img src="{{logo}}">')

    assert.equal(doc.includes('undefined'), false)
    assert.equal(doc.includes('null'), false)
  })

  test('brand colours reach the frame as variables', () => {
    const doc = build('<div style="color: var(--accent)">x</div>')

    assert.match(doc, /--primary:/)
    assert.match(doc, /--accent:/)
  })
})

describe('bounds', () => {
  test('an enormous composition is rejected', () => {
    const parsed = schema.composition.safeParse({
      html: 'x'.repeat(50_000),
      summary: '',
      durationMs: 3000,
    })

    assert.equal(parsed.success, false)
  })

  test('a duration outside what an alert should occupy is rejected', () => {
    for (const durationMs of [10, 60_000]) {
      const parsed = schema.composition.safeParse({
        html: '<div>x</div>',
        summary: '',
        durationMs,
      })
      assert.equal(parsed.success, false, `${durationMs} should be rejected`)
    }
  })
})
