/**
 * Text going into a generated composition.
 *
 * Compositions are HTML files written by this app and then opened in a real
 * browser by the renderer. Brand names, headlines and subheads are free text,
 * so everything user-written is escaped on the way in — not because a local
 * user is attacking themselves, but because an unescaped apostrophe in a brand
 * name is otherwise a broken render with no obvious cause.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character])
}

/**
 * The single character that stands in for a brand as a mark.
 *
 * Falls back to a bullet rather than an empty box: a brand called "★" should
 * still produce a composition, and an empty mark is a hole in the frame.
 */
export function brandInitial(name: string): string {
  const match = name.match(/[\p{L}\p{N}]/u)
  return (match ? match[0] : '•').toUpperCase()
}

/**
 * A font size that keeps `text` on roughly one line inside `maxWidth`.
 *
 * An approximation, and knowingly so: the renderer has no font metrics at build
 * time, and the machine's actual fonts are not known until the browser opens
 * the file. It is paired with real wrapping in CSS, so a bad guess wraps
 * instead of overflowing, and `hyperframes check` audits the result either way.
 */
export function fitFontSize(
  text: string,
  options: { max: number; min: number; maxWidth: number; averageGlyphRatio?: number },
): number {
  const ratio = options.averageGlyphRatio ?? 0.62
  const length = Math.max(1, text.trim().length)
  const ideal = options.maxWidth / (length * ratio)
  return Math.round(Math.max(options.min, Math.min(options.max, ideal)))
}
