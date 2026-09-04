import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import test, { describe } from 'node:test'

import { CURRENT_PHASE, isAvailable, navigation } from '../src/config/navigation.ts'

/**
 * Every unlocked navigation destination must have a page behind it.
 *
 * This caught a real bug: four items were marked as shipping in the current
 * phase but had no route, so Next prefetched them in the background and got a
 * stream of 404s — and anyone clicking one would have hit a dead link.
 *
 * The failure was invisible in the UI, which is exactly why it needs a test.
 */

const APP_DIR = path.resolve(import.meta.dirname, '..', 'src', 'app')

/**
 * Resolves a route to a page file, trying the route group the app shell lives
 * in as well as the bare path.
 */
function pageExists(href: string): boolean {
  const segments = href.replace(/^\//, '')

  return [
    path.join(APP_DIR, '(app)', segments, 'page.tsx'),
    path.join(APP_DIR, segments, 'page.tsx'),
  ].some((candidate) => existsSync(candidate))
}

const allItems = navigation.flatMap((section) => section.items)

describe('navigation', () => {
  test('every unlocked destination has a page', () => {
    const broken = allItems
      .filter(isAvailable)
      .filter((item) => !pageExists(item.href))
      .map((item) => `${item.label} → ${item.href}`)

    assert.deepEqual(
      broken,
      [],
      'these are unlocked but have no page, so they 404 when prefetched or clicked',
    )
  })

  test('every page that exists is reachable from the navigation', () => {
    // The reverse direction: a built page nothing links to is invisible.
    const linked = new Set(allItems.map((item) => item.href))
    const built = ['/dashboard', '/brand', '/stream/overlays', '/stream/alerts', '/settings']

    for (const href of built) {
      assert.ok(linked.has(href), `${href} exists but is not in the navigation`)
    }
  })

  test('locked destinations are all in a future phase', () => {
    for (const item of allItems) {
      if (isAvailable(item)) continue
      assert.ok(
        item.phase > CURRENT_PHASE,
        `${item.label} is locked but its phase (${item.phase}) is not in the future`,
      )
    }
  })

  test('no two destinations share a href', () => {
    const seen = new Map<string, string>()

    for (const item of allItems) {
      const previous = seen.get(item.href)
      assert.equal(
        previous,
        undefined,
        `${item.label} and ${previous} both point at ${item.href}`,
      )
      seen.set(item.href, item.label)
    }
  })
})
