import 'server-only'

import crypto from 'node:crypto'

/**
 * Opaque identifiers for OBS browser-source URLs.
 *
 * These end up pasted into OBS and can sit there for months, so they must be
 * unguessable and carry no meaning: no account ID, no sequential number,
 * nothing derived from the overlay's own row. Rotating one is just generating
 * a new value and saving it.
 */
export function generateOverlayToken(): string {
  // 32 hex characters — 128 bits, URL-safe without encoding concerns.
  return crypto.randomBytes(16).toString('hex')
}
