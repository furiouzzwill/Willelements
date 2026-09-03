import 'server-only'

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { DATA_DIR } from '@/lib/db'

/**
 * Encryption for provider tokens at rest.
 *
 * A Twitch access token is a bearer credential for someone's channel. Storing
 * it in plaintext would mean a copied `app.db` — or a backup zip shared for
 * support — hands over control of the channel. Encrypting it means the database
 * alone is not enough.
 *
 * The key lives outside the database, in `data/.token-key`, and is generated on
 * first use. Set `TOKEN_ENCRYPTION_KEY` to override it (32 bytes, hex).
 *
 * Losing the key is not a disaster: it means reconnecting Twitch. Everything
 * else in the database is unaffected. That is the deliberate trade — see
 * ARCHITECTURE.md risk R6.
 *
 * AES-256-GCM: authenticated, so a tampered ciphertext fails to decrypt rather
 * than silently producing garbage.
 */

const KEY_FILE = '.token-key'
const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

let cachedKey: Buffer | null = null

function loadKey(): Buffer {
  if (cachedKey) return cachedKey

  const fromEnv = process.env.TOKEN_ENCRYPTION_KEY
  if (fromEnv) {
    const key = Buffer.from(fromEnv.trim(), 'hex')
    if (key.length !== 32) {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY must be 32 bytes of hex (64 characters). ' +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      )
    }
    cachedKey = key
    return key
  }

  const keyPath = path.join(DATA_DIR, KEY_FILE)

  if (existsSync(keyPath)) {
    cachedKey = Buffer.from(readFileSync(keyPath, 'utf8').trim(), 'hex')
    return cachedKey
  }

  // First run: generate a key and keep it beside the database, readable only
  // by this user. Written before any token exists, so nothing is ever stored
  // unencrypted while waiting for one.
  mkdirSync(DATA_DIR, { recursive: true })
  const key = crypto.randomBytes(32)
  writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 })
  try {
    chmodSync(keyPath, 0o600)
  } catch {
    // Windows does not honour POSIX modes; the file is still outside the database.
  }

  cachedKey = key
  return key
}

/** Encrypts a token. Output is `iv:tag:ciphertext`, all base64url. */
export function seal(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, loadKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join(':')
}

/**
 * Decrypts a token. Throws if the value was tampered with, or if the key has
 * changed — callers treat that as "reconnect the platform", not as a crash.
 */
export function open(sealed: string): string {
  const parts = sealed.split(':')
  if (parts.length !== 3) throw new Error('Malformed sealed value.')

  const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64url'))
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Malformed sealed value.')
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, loadKey(), iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/** Decrypts, returning null instead of throwing when the value is unreadable. */
export function tryOpen(sealed: string | null): string | null {
  if (!sealed) return null
  try {
    return open(sealed)
  } catch {
    return null
  }
}
