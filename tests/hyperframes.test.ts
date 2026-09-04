import assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import {
  bestContrast,
  bestContrastAcross,
  contrast,
  ensureContrast,
  luminance,
  mix,
  parseHex,
  toHex,
  withAlpha,
} from '../src/lib/hyperframes/color.ts'
import { brandInitial, escapeHtml, fitFontSize } from '../src/lib/hyperframes/html.ts'
import { fontStack, toVisualIdentity } from '../src/lib/hyperframes/identity.ts'
import { COMPOSITION_TEMPLATES, findTemplate } from '../src/lib/hyperframes/templates/index.ts'
import { brandDna, defaultBrandDna, type BrandDna } from '../src/lib/schemas/brand.ts'

/**
 * Brand DNA → composition, end to end but without touching disk.
 *
 * Templates are pure functions from an identity to an HTML string, which is the
 * whole reason they were written that way: the file the renderer will open can
 * be asserted against here, in milliseconds, instead of only being discovered
 * to be wrong after a two-minute render.
 */

function dnaWith(overrides: Parameters<typeof brandDna.parse>[0]): BrandDna {
  return brandDna.parse(overrides)
}

describe('colour maths', () => {
  test('hex round-trips and normalises case', () => {
    assert.deepEqual(parseHex('#a855f7'), { r: 168, g: 85, b: 247 })
    assert.equal(toHex(parseHex('#a855f7')), '#A855F7')
  })

  test('contrast spans the full WCAG range', () => {
    assert.equal(Math.round(contrast('#000000', '#FFFFFF')), 21)
    assert.equal(contrast('#123456', '#123456'), 1)
  })

  test('luminance orders light above dark', () => {
    assert.ok(luminance('#FFFFFF') > luminance('#808080'))
    assert.ok(luminance('#808080') > luminance('#000000'))
  })

  test('mix moves between two colours and clamps outside 0–1', () => {
    assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080')
    assert.equal(mix('#000000', '#FFFFFF', 2), '#FFFFFF')
    assert.equal(mix('#000000', '#FFFFFF', -1), '#000000')
  })

  test('bestContrast maximises legibility, floor included', () => {
    // Neither candidate is readable on white; the appended black rescues it.
    assert.equal(bestContrast('#FFFFFF', ['#FEFEFE', '#F5F5F5']), '#000000')
  })

  test('bestContrastAcross optimises the worst background, not the first', () => {
    // Light text wins against the dark end; dark text wins against the light
    // end. Across both, the choice has to be the one whose weakest case is best.
    const chosen = bestContrastAcross(['#111111', '#EEEEEE'], ['#FFFFFF', '#000000'])
    const worst = (color: string) =>
      Math.min(contrast('#111111', color), contrast('#EEEEEE', color))

    assert.ok(worst(chosen) >= worst('#FFFFFF'))
    assert.ok(worst(chosen) >= worst('#000000'))
  })

  test('ensureContrast leaves a colour that already passes untouched', () => {
    assert.equal(ensureContrast('#FFFFFF', '#000000', 7), '#FFFFFF')
  })

  test('ensureContrast lifts one that fails, and stops as soon as it passes', () => {
    const fixed = ensureContrast('#555555', '#333333', 4.5)

    assert.notEqual(fixed, '#555555')
    assert.ok(contrast(fixed, '#333333') >= 4.5)
    // Not simply thrown at white: the point is the smallest change that works.
    assert.notEqual(fixed, '#FFFFFF')
  })

  test('withAlpha keeps the channels and adds opacity', () => {
    assert.equal(withAlpha('#A855F7', 0.25), 'rgba(168, 85, 247, 0.25)')
    assert.equal(withAlpha('#A855F7', 5), 'rgba(168, 85, 247, 1)')
  })
})

describe('html helpers', () => {
  test('escapes every character that could break out of markup', () => {
    assert.equal(escapeHtml(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
  })

  test('brand initial handles punctuation, accents and emptiness', () => {
    assert.equal(brandInitial('nightshift gaming'), 'N')
    assert.equal(brandInitial('  ünter'), 'Ü')
    assert.equal(brandInitial('42 Studios'), '4')
    assert.equal(brandInitial('★'), '•')
    assert.equal(brandInitial(''), '•')
  })

  test('font size shrinks with length and respects both bounds', () => {
    const short = fitFontSize('Ash', { max: 132, min: 52, maxWidth: 1180 })
    const long = fitFontSize('A'.repeat(60), { max: 132, min: 52, maxWidth: 1180 })

    assert.equal(short, 132)
    assert.equal(long, 52)
  })

  test('font stacks strip anything that could escape a declaration', () => {
    assert.equal(
      fontStack('Space Grotesk"; } body { display: none', 'sans-serif'),
      '"Space Grotesk  body  display none", sans-serif',
    )
    assert.equal(fontStack('###', 'sans-serif'), 'sans-serif')
  })
})

describe('brand DNA becomes a visual identity', () => {
  test('speed sets the base duration, and every other timing follows it', () => {
    const slow = toVisualIdentity(dnaWith({ motionStyle: { speed: 'slow' } }))
    const fast = toVisualIdentity(dnaWith({ motionStyle: { speed: 'fast' } }))

    assert.ok(slow.motion.duration.base > fast.motion.duration.base)
    assert.ok(slow.motion.duration.quick < slow.motion.duration.base)
    assert.ok(slow.motion.duration.slow > slow.motion.duration.base)
  })

  test('energy sets how far things travel and how tightly they stagger', () => {
    const low = toVisualIdentity(dnaWith({ motionStyle: { energy: 'low' } }))
    const high = toVisualIdentity(dnaWith({ motionStyle: { energy: 'high' } }))

    assert.ok(high.motion.travel > low.motion.travel)
    assert.ok(high.motion.stagger < low.motion.stagger)
  })

  test('the first motion style sets the curve', () => {
    const explosive = toVisualIdentity(dnaWith({ motionStyle: { style: ['explosive'] } }))
    assert.match(explosive.motion.ease.entrance, /^back\.out/)
  })

  test('accents come from every listed style, not just the first', () => {
    const identity = toVisualIdentity(dnaWith({ motionStyle: { style: ['smooth', 'glitch'] } }))

    assert.equal(identity.motion.ease.entrance, 'power2.out')
    assert.equal(identity.motion.accents.glitch, true)
  })

  test('an empty style list still produces a usable identity', () => {
    const identity = toVisualIdentity(dnaWith({ motionStyle: { style: [] } }))

    assert.equal(identity.motion.ease.entrance, 'power2.out')
    assert.ok(identity.motion.duration.base > 0)
  })

  test('a light canvas lightens a dark brand background instead of ignoring it', () => {
    const identity = toVisualIdentity(
      dnaWith({
        colors: { background: '#09090B' },
        visualStyle: { canvas: 'light' },
      }),
    )

    assert.ok(luminance(identity.colors.background) > 0.5)
    // And the text still reads on it.
    assert.ok(contrast(identity.colors.text, identity.colors.background) >= 7)
  })

  test('a background already matching the canvas is left exactly as chosen', () => {
    const identity = toVisualIdentity(dnaWith({ colors: { background: '#09090B' } }))
    assert.equal(identity.colors.background, '#09090B')
  })

  test("the brand's own ink survives when it is already readable", () => {
    const identity = toVisualIdentity(
      dnaWith({
        colors: { background: '#F5F2EC', text: '#1A1712' },
        visualStyle: { canvas: 'light' },
      }),
    )

    assert.equal(identity.colors.text, '#1A1712')
  })

  test('text on the mark reads against both ends of its gradient', () => {
    const identity = toVisualIdentity(
      dnaWith({ colors: { primary: '#A855F7', secondary: '#D946EF' } }),
    )

    assert.ok(contrast(identity.colors.onPrimary, '#A855F7') >= 3)
    assert.ok(contrast(identity.colors.onPrimary, '#D946EF') >= 3)
  })

  test('the CSS block declares every token the templates use', () => {
    const identity = toVisualIdentity(defaultBrandDna())

    for (const token of [
      '--hf-primary',
      '--hf-accent-readable',
      '--hf-background',
      '--hf-text',
      '--hf-muted',
      '--hf-on-primary',
      '--hf-font-heading',
      '--hf-tracking',
      '--hf-radius',
      '--hf-hairline',
    ]) {
      assert.ok(identity.css.includes(`${token}:`), `missing ${token}`)
    }
  })
})

describe('composition templates', () => {
  const identity = toVisualIdentity(defaultBrandDna())

  const build = (templateId: string, overrides?: { headline?: string; subhead?: string }) => {
    const template = findTemplate(templateId)
    assert.ok(template, `no template ${templateId}`)

    const durationSeconds = template.duration(identity)
    const html = template.build({
      identity,
      brandName: 'NightShift Gaming',
      input: { ...template.defaults('NightShift Gaming'), ...overrides },
      logoSrc: null,
      width: template.width,
      height: template.height,
      durationSeconds,
    })

    return { template, html, durationSeconds }
  }

  test('the registry is unique and lists the animated logo first', () => {
    const ids = COMPOSITION_TEMPLATES.map((template) => template.id)

    assert.equal(new Set(ids).size, ids.length)
    assert.equal(ids[0], 'logo-sting')
    assert.equal(findTemplate('does-not-exist'), null)
  })

  for (const template of COMPOSITION_TEMPLATES) {
    test(`${template.id} satisfies the HyperFrames root contract`, () => {
      const { html, durationSeconds } = build(template.id)

      assert.match(html, /^<!doctype html>/)
      assert.match(html, /data-composition-id="main"/)
      assert.equal(html.includes(`data-width="${template.width}"`), true)
      assert.equal(html.includes(`data-height="${template.height}"`), true)
      assert.equal(html.includes(`data-duration="${durationSeconds}"`), true)

      // A timeline created paused and registered under the composition id is
      // what makes the file renderable at all.
      assert.match(html, /gsap\.timeline\(\{ paused: true \}\)/)
      assert.match(html, /window\.__timelines\["main"\] = tl;/)
    })

    test(`${template.id} loads GSAP from the project, never a CDN`, () => {
      const { html } = build(template.id)

      assert.match(html, /<script src="assets\/vendor\/gsap\.min\.js"><\/script>/)
      // The first version of this pipeline used a CDN tag and every render
      // failed on a navigation timeout. Nothing may reach the network.
      assert.equal(/https?:\/\//.test(html), false)
    })

    test(`${template.id} interpolates real numbers everywhere`, () => {
      const { html } = build(template.id)

      assert.equal(html.includes('NaN'), false)
      assert.equal(html.includes('undefined'), false)
      assert.equal(html.includes('[object Object]'), false)
    })

    test(`${template.id} escapes brand text`, () => {
      const { html } = build(template.id, {
        headline: `Rock & "Roll" <script>`,
        subhead: `it's live`,
      })

      assert.equal(html.includes('<script>Rock'), false)
      assert.match(html, /Rock &amp; &quot;Roll&quot; &lt;script&gt;/)
      assert.match(html, /it&#39;s live/)
    })

    test(`${template.id} has a duration a renderer can use`, () => {
      const { durationSeconds } = build(template.id)

      assert.ok(durationSeconds > 0)
      assert.ok(durationSeconds <= 30)
    })
  }

  test('a slower brand gets a longer sting than a faster one', () => {
    const sting = findTemplate('logo-sting')
    assert.ok(sting)

    const cinematic = toVisualIdentity(
      dnaWith({ motionStyle: { speed: 'slow', style: ['cinematic'] } }),
    )
    const snappy = toVisualIdentity(dnaWith({ motionStyle: { speed: 'fast', style: ['fast'] } }))

    assert.ok(sting.duration(cinematic) > sting.duration(snappy))
  })

  test('the sting drops its tagline element when there is no tagline', () => {
    const withTag = build('logo-sting', { subhead: 'Every Thursday' })
    const without = build('logo-sting', { subhead: '' })

    assert.match(withTag.html, /id="tagline"/)
    assert.equal(without.html.includes('id="tagline"'), false)
    // The length is deliberately not affected by an optional field.
    assert.equal(withTag.durationSeconds, without.durationSeconds)
  })

  test('the scene card is built to loop: no entrance, only cyclic motion', () => {
    const { html, durationSeconds } = build('scene-card')

    // Anything tweened `from` a hidden state would pop on every restart.
    assert.equal(html.includes('.from('), false)

    // A full rotation ends where it started.
    assert.match(html, /rotation: 360/)

    // Every yoyo tween must run an even number of legs, or it finishes at the
    // far end of the tween and the loop seam shows.
    const yoyos = [...html.matchAll(/repeat: (\d+), yoyo: true/g)]
    assert.ok(yoyos.length > 0)
    for (const [, repeat] of yoyos) {
      assert.equal((Number(repeat) + 1) % 2, 0, `repeat: ${repeat} leaves an odd number of legs`)
    }

    assert.equal(durationSeconds, 8)
  })

  test('the lower third is transparent, and encoded in a format that carries it', () => {
    const template = findTemplate('lower-third')
    assert.ok(template)
    assert.equal(template.format, 'webm')

    const { html } = build('lower-third')

    assert.match(html, /background: transparent/)
    // Full-frame decorative washes would tint the whole stream. The shared
    // stylesheet still defines them; what matters is that none is placed.
    assert.equal(html.includes('<div class="layer layer-vignette"'), false)
    assert.equal(html.includes('<div class="layer layer-grain"'), false)
    assert.equal(html.includes('<div class="layer layer-glow"'), false)
  })

  test('a logo replaces the letter mark when the brand has one', () => {
    const sting = findTemplate('logo-sting')
    assert.ok(sting)

    const html = sting.build({
      identity,
      brandName: 'NightShift Gaming',
      input: sting.defaults('NightShift Gaming'),
      logoSrc: 'assets/logo.png',
      width: sting.width,
      height: sting.height,
      durationSeconds: sting.duration(identity),
    })

    assert.match(html, /<img id="mark" class="mark mark-image" src="assets\/logo\.png"/)
    assert.equal(html.includes('class="mark mark-letter"'), false)
  })
})
