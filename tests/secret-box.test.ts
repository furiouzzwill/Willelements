import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after, before, describe } from 'node:test'

/** Token encryption at rest. */

const workspace = mkdtempSync(path.join(tmpdir(), 'we-crypto-'))
process.env.WILLELEMENTS_DATA_DIR = workspace
delete process.env.TOKEN_ENCRYPTION_KEY

type Box = typeof import('../src/lib/crypto/secret-box.ts')
let box: Box

before(async () => {
  box = await import('../src/lib/crypto/secret-box.ts')
})

after(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('sealing tokens', () => {
  test('round-trips a value', () => {
    const secret = 'oauth-token-abc123'
    assert.equal(box.open(box.seal(secret)), secret)
  })

  test('the ciphertext does not contain the plaintext', () => {
    const secret = 'super-secret-refresh-token'
    const sealed = box.seal(secret)

    assert.ok(!sealed.includes(secret), 'the token must not be recoverable by eye')
    assert.ok(!Buffer.from(sealed).toString('utf8').includes(secret))
  })

  test('the same value seals differently each time', () => {
    // A fresh IV per call, so identical tokens do not produce identical rows.
    assert.notEqual(box.seal('same'), box.seal('same'))
  })

  test('generates a key file outside the database, readable only by the owner', () => {
    const keyPath = path.join(workspace, '.token-key')
    assert.ok(existsSync(keyPath), 'the key is kept beside the database, not inside it')

    if (process.platform !== 'win32') {
      const mode = statSync(keyPath).mode & 0o777
      assert.equal(mode, 0o600, 'the key file is not world-readable')
    }
  })
})

describe('tamper resistance', () => {
  test('rejects a modified ciphertext instead of returning garbage', () => {
    const sealed = box.seal('token')
    const [iv, tag, ciphertext] = sealed.split(':')

    // Flip a byte in the ciphertext.
    const bytes = Buffer.from(ciphertext, 'base64url')
    bytes[0] ^= 0xff
    const tampered = [iv, tag, bytes.toString('base64url')].join(':')

    assert.throws(() => box.open(tampered), 'GCM authentication must reject this')
    assert.equal(box.tryOpen(tampered), null)
  })

  test('rejects a malformed value', () => {
    assert.throws(() => box.open('not-sealed'))
    assert.equal(box.tryOpen('not-sealed'), null)
    assert.equal(box.tryOpen('a:b:c'), null)
    assert.equal(box.tryOpen(null), null)
  })
})
