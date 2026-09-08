import { z } from 'zod'

/**
 * A generated alert composition — real HTML, CSS and JavaScript.
 *
 * This is the deliberate exception to the rule in `docs/ai-generation.md` that
 * the rest of the app follows. It was added on the owner's explicit and
 * repeated instruction, after the composed-timeline approach was judged not
 * expressive enough. The trade is written down here rather than left implied,
 * because whoever reads this next deserves to know it was a decision and not
 * an oversight.
 *
 * **What is given up.** A model now writes code that runs. It can be wrong in
 * ways a schema cannot catch: an infinite loop, an exception on frame one, a
 * layout that covers the whole stream.
 *
 * **What contains it.** The code never runs in the application. It runs in an
 * iframe with `sandbox="allow-scripts"` and nothing else, which means:
 *
 *  - no access to the parent document, so it cannot read or alter the app;
 *  - a null origin, so no cookies, no `localStorage`, no IndexedDB;
 *  - a Content-Security-Policy inside the frame that permits no network of any
 *    kind, so nothing can be fetched and nothing can be sent anywhere;
 *  - no forms, no popups, no top-level navigation.
 *
 * And it is never saved until it has actually been rendered once and observed
 * not to throw. The frame reports that outward by `postMessage`, which is the
 * only channel out of a null-origin frame — the parent cannot read its title
 * or its DOM — and the save button stays disabled until a clean run arrives.
 *
 * The residual risk is a composition that runs but looks wrong, which is the
 * same risk as any animation someone writes by hand — and it is previewed
 * before it is saved.
 */

/** Generous for a self-contained composition, bounded so nothing pathological is stored. */
const MAX_LENGTH = 24_000

export const composition = z.object({
  /**
   * A complete document body: markup, a `<style>`, and a `<script>`.
   *
   * Not a fragment spliced into the app's DOM — that would be the dangerous
   * version. It is the entire contents of an isolated frame.
   */
  html: z.string().min(1).max(MAX_LENGTH),
  /** What the model says it built, shown next to the preview. */
  summary: z.string().trim().max(300).prefault(''),
  /** Milliseconds the composition needs before it should be torn down. */
  durationMs: z.number().int().min(500).max(15_000).prefault(4000),
})

export type Composition = z.infer<typeof composition>

/**
 * Things that have no business in a composition, checked before it is stored.
 *
 * The sandbox is what actually contains the code; this is a second, cheaper
 * layer that rejects the obviously wrong before a person ever previews it.
 * It is not a parser and does not pretend to be — a determined bypass is
 * possible and would still land inside the sandbox, which is the point of
 * having one.
 */
const FORBIDDEN: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bfetch\s*\(/i, reason: 'network access' },
  { pattern: /XMLHttpRequest/i, reason: 'network access' },
  { pattern: /\bWebSocket\b/i, reason: 'network access' },
  { pattern: /\bimport\s*\(/i, reason: 'dynamic import' },
  { pattern: /\bnavigator\s*\.\s*sendBeacon/i, reason: 'network access' },
  { pattern: /\bwindow\s*\.\s*(parent|top|opener)/i, reason: 'reaching outside the frame' },
  // The frame reports its own health outward by postMessage. A composition
  // that could send one too could claim to have started cleanly when it did
  // not, so the channel stays the wrapper's alone. The lookbehind is what
  // keeps `rect.top` and `node.parent` out of it.
  {
    pattern: /(?<![.\w$])(parent|top|opener|self|globalThis|window)\s*\.\s*postMessage/i,
    reason: 'messaging out of the frame',
  },
  { pattern: /(?<![.\w$])postMessage\s*\(/i, reason: 'messaging out of the frame' },
  { pattern: /\bdocument\s*\.\s*cookie/i, reason: 'cookie access' },
  { pattern: /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/i, reason: 'storage access' },
  { pattern: /\bwhile\s*\(\s*true\s*\)/i, reason: 'an unbounded loop' },
  { pattern: /\bfor\s*\(\s*;\s*;\s*\)/i, reason: 'an unbounded loop' },
  { pattern: /<\s*iframe/i, reason: 'a nested frame' },
  { pattern: /\bsrc\s*=\s*["']?https?:/i, reason: 'loading something remote' },
]

export type CompositionIssue = { reason: string }

export function screenComposition(html: string): CompositionIssue[] {
  return FORBIDDEN.filter((rule) => rule.pattern.test(html)).map((rule) => ({
    reason: rule.reason,
  }))
}

/**
 * The frame's own policy, injected above whatever the model wrote.
 *
 * Belt and braces with the sandbox attribute: the attribute stops it reaching
 * out of the frame, this stops it reaching out of the machine. `default-src`
 * covers every fetch destination there is, and `'unsafe-inline'` is scoped to
 * the frame's own inline script and style, which is the whole composition.
 */
export const FRAME_CSP =
  "default-src 'none'; " +
  "style-src 'unsafe-inline'; " +
  "script-src 'unsafe-inline'; " +
  "img-src data:; " +
  "font-src data:;"
