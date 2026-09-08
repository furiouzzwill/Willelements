import assert from 'node:assert/strict'
import test, { before, describe } from 'node:test'

/**
 * Compiling a timeline into CSS.
 *
 * This module is the one that turns something a model produced into text a
 * browser executes as style, so the tests are mostly about what must *not* get
 * through: an identifier that could close a rule, a value outside what the
 * layout can survive, two alerts sharing keyframe names.
 */

type Compile = typeof import('../src/lib/motion/compile.ts')
type Motion = typeof import('../src/lib/schemas/motion.ts')

let compile: Compile
let motion: Motion

before(async () => {
  compile = await import('../src/lib/motion/compile.ts')
  motion = await import('../src/lib/schemas/motion.ts')
})

function timeline(
  overrides: Partial<import('../src/lib/schemas/motion.ts').MotionTimelineInput> = {},
) {
  return motion.motionTimeline.parse({
    exitMs: 320,
    tracks: [
      {
        part: 'card',
        delayMs: 0,
        durationMs: 500,
        easing: 'overshoot',
        keyframes: [
          { at: 0, opacity: 0, y: -40, scale: 0.8 },
          { at: 100, opacity: 1, y: 0, scale: 1 },
        ],
      },
    ],
    ...overrides,
  })
}

describe('compiling', () => {
  test('produces keyframes and an animation shorthand for each part', () => {
    const result = compile.compileMotion(timeline(), 'abc')

    assert.match(result.css, /@keyframes we-abc-card \{/)
    assert.match(result.css, /0% \{/)
    assert.match(result.css, /100% \{/)
    assert.ok(result.animations.card?.includes('we-abc-card'))
    assert.ok(result.animations.card?.includes('500ms'))
  })

  test('easings become CSS timing functions, never raw text', () => {
    const result = compile.compileMotion(timeline(), 'abc')

    // The value is looked up in a table. A model cannot supply a timing
    // function, only choose one.
    assert.ok(result.animations.card?.includes(motion.EASING_CSS.overshoot))
  })

  test('two alerts do not share keyframe names', () => {
    const first = compile.compileMotion(timeline(), 'one')
    const second = compile.compileMotion(timeline(), 'two')

    // Sharing them would make the second alert silently animate with the
    // first's motion, which is the kind of bug nobody reproduces on demand.
    assert.notEqual(first.animations.card, second.animations.card)
    assert.match(first.css, /we-one-card/)
    assert.match(second.css, /we-two-card/)
  })

  test('an id that could escape the stylesheet is stripped', () => {
    const result = compile.compileMotion(timeline(), 'a} body { display: none } .x{')

    // The property that matters is not that the words are gone — letters are
    // harmless inside an identifier, and "body" survives here as part of one.
    // It is that nothing which could *end* the identifier does: no braces, no
    // colon, no semicolon, no whitespace.
    const name = /@keyframes (\S+) \{/.exec(result.css)?.[1]
    assert.ok(name)
    assert.match(name, /^[a-zA-Z0-9_-]+$/)

    // And no second rule was smuggled in: exactly one block, one selector.
    assert.equal([...result.css.matchAll(/@keyframes/g)].length, 1)
    assert.equal(result.css.includes('display: none'), false)
  })

  test('keyframes are sorted, so an out-of-order list still plays forwards', () => {
    const result = compile.compileMotion(
      timeline({
        tracks: [
          {
            part: 'card',
            delayMs: 0,
            durationMs: 400,
            easing: 'linear',
            keyframes: [
              { at: 100, opacity: 1 },
              { at: 50, opacity: 0.5 },
              { at: 0, opacity: 0 },
            ],
          },
        ],
      }),
      'x',
    )

    const order = [...result.css.matchAll(/(\d+(?:\.\d+)?)% \{/g)].map((match) =>
      Number(match[1]),
    )
    assert.deepEqual(order, [0, 50, 100])
  })

  test('one part cannot end up with two competing animations', () => {
    const result = compile.compileMotion(
      timeline({
        tracks: [
          {
            part: 'card',
            delayMs: 0,
            durationMs: 400,
            easing: 'linear',
            keyframes: [
              { at: 0, opacity: 0 },
              { at: 100, opacity: 1 },
            ],
          },
          {
            part: 'card',
            delayMs: 0,
            durationMs: 900,
            easing: 'bounce-out',
            keyframes: [
              { at: 0, scale: 0 },
              { at: 100, scale: 1 },
            ],
          },
        ],
      }),
      'x',
    )

    // The last listed wins. Two animations on one element resolve in a way
    // nobody would predict from reading the spec.
    assert.equal(Object.keys(result.animations).length, 1)
    assert.ok(result.animations.card?.includes('900ms'))
  })

  test('a keyframe that sets nothing still lands on a known value', () => {
    const result = compile.compileMotion(
      timeline({
        tracks: [
          {
            part: 'card',
            delayMs: 0,
            durationMs: 400,
            easing: 'linear',
            keyframes: [{ at: 0 }, { at: 100 }],
          },
        ],
      }),
      'x',
    )

    // An empty block is legal CSS but makes the browser hold whatever was
    // there, rather than interpolating to something the spec chose.
    assert.equal(result.css.includes('{  }'), false)
    assert.match(result.css, /opacity: 1/)
  })
})

describe('bounds', () => {
  test('a translate that would leave the canvas is rejected', () => {
    const parsed = motion.motionTrack.safeParse({
      part: 'card',
      delayMs: 0,
      durationMs: 400,
      easing: 'linear',
      keyframes: [
        { at: 0, x: 99999 },
        { at: 100, x: 0 },
      ],
    })

    assert.equal(parsed.success, false)
  })

  test('a scale that would cover the stream is rejected', () => {
    const parsed = motion.motionTrack.safeParse({
      part: 'card',
      delayMs: 0,
      durationMs: 400,
      easing: 'linear',
      keyframes: [
        { at: 0, scale: 50 },
        { at: 100, scale: 1 },
      ],
    })

    assert.equal(parsed.success, false)
  })

  test('an invented part is rejected', () => {
    const parsed = motion.motionTrack.safeParse({
      part: 'confetti',
      delayMs: 0,
      durationMs: 400,
      easing: 'linear',
      keyframes: [{ at: 0 }, { at: 100 }],
    })

    assert.equal(parsed.success, false)
  })

  test('an easing that is not in the table is rejected', () => {
    // The alternative is a model supplying `cubic-bezier(...)` text that goes
    // straight into a stylesheet.
    const parsed = motion.motionTrack.safeParse({
      part: 'card',
      delayMs: 0,
      durationMs: 400,
      easing: 'cubic-bezier(0,0,1,1)',
      keyframes: [{ at: 0 }, { at: 100 }],
    })

    assert.equal(parsed.success, false)
  })

  test('a track needs at least a start and an end', () => {
    const parsed = motion.motionTrack.safeParse({
      part: 'card',
      delayMs: 0,
      durationMs: 400,
      easing: 'linear',
      keyframes: [{ at: 0 }],
    })

    assert.equal(parsed.success, false)
  })

  test('every easing in the list has a CSS value', () => {
    for (const easing of motion.MOTION_EASINGS) {
      assert.ok(motion.EASING_CSS[easing], `${easing} has no CSS timing function`)
    }
  })
})
