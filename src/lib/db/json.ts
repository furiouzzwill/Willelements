import type { z } from 'zod'

/**
 * Typed access to JSON columns.
 *
 * SQLite stores these as text and Drizzle hands them back as `unknown`. Every
 * read goes through a schema, so a column written by an older version of the
 * app — or edited by hand in a SQLite browser — cannot leak an unexpected shape
 * into the rest of the code.
 *
 * Reads are forgiving by design: a malformed value falls back to the schema's
 * defaults rather than crashing the page. Losing a customisation is recoverable;
 * a dashboard that will not load mid-stream is not.
 *
 * Writes are strict — bad data never enters the database in the first place.
 */

/** Parse a value read from a JSON column, falling back to schema defaults. */
export function readJson<T>(
  schema: z.ZodType<T>,
  value: unknown,
  context: string,
): T {
  const parsed = schema.safeParse(value ?? {})
  if (parsed.success) return parsed.data

  const fallback = schema.safeParse({})
  if (fallback.success) {
    console.warn(
      `[db] ${context} held an unexpected shape and was read with defaults. ` +
        `Issues: ${parsed.error.issues.map((i) => i.path.join('.') || '(root)').join(', ')}`,
    )
    return fallback.data
  }

  // The schema has no usable empty form — this is a programming error, not data.
  throw new Error(`${context} is invalid and has no default: ${parsed.error.message}`)
}

/** Validate a value on its way into a JSON column. Throws on invalid input. */
export function writeJson<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value)
}
