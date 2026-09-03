import assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import { detectType, MAX_UPLOAD_BYTES } from '../src/lib/services/asset-service.ts'

/** Builds a buffer beginning with the given signature bytes. */
function withSignature(bytes: number[], length = 64): Uint8Array {
  const buffer = new Uint8Array(length)
  buffer.set(bytes, 0)
  return buffer
}

const PNG = withSignature([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG = withSignature([0xff, 0xd8, 0xff, 0xe0])
const GIF = withSignature([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])

function riff(tag: string): Uint8Array {
  const buffer = withSignature([0x52, 0x49, 0x46, 0x46])
  buffer.set([...tag].map((c) => c.charCodeAt(0)), 8)
  return buffer
}

describe('file type detection', () => {
  test('identifies the image formats we accept', () => {
    assert.equal(detectType(PNG)?.mime, 'image/png')
    assert.equal(detectType(JPEG)?.mime, 'image/jpeg')
    assert.equal(detectType(GIF)?.mime, 'image/gif')
    assert.equal(detectType(riff('WEBP'))?.mime, 'image/webp')
  })

  test('distinguishes WebP from WAV — both are RIFF containers', () => {
    assert.equal(detectType(riff('WEBP'))?.kind, 'image')
    assert.equal(detectType(riff('WAVE'))?.kind, 'sound')
  })

  test('rejects a file whose contents are not a supported type', () => {
    const text = new TextEncoder().encode('this is just some text, at length')
    assert.equal(detectType(text), null)
  })

  test('rejects an executable renamed to look like an image', () => {
    // The point of sniffing content: the name and Content-Type are both
    // trivially wrong, so neither is consulted.
    const elf = withSignature([0x7f, 0x45, 0x4c, 0x46])
    assert.equal(detectType(elf), null)

    const script = new TextEncoder().encode('#!/bin/sh\nrm -rf /\n')
    assert.equal(detectType(script), null)
  })

  test('rejects a file too short to identify', () => {
    assert.equal(detectType(new Uint8Array([0x89, 0x50])), null)
  })

  test('rejects an empty file', () => {
    assert.equal(detectType(new Uint8Array(0)), null)
  })

  test('reports an extension that matches the detected type', () => {
    // The stored filename is derived from this, never from the upload's name.
    assert.equal(detectType(PNG)?.extension, 'png')
    assert.equal(detectType(JPEG)?.extension, 'jpg')
  })
})

describe('upload limits', () => {
  test('caps uploads at a size that will not fill a disk by accident', () => {
    assert.equal(MAX_UPLOAD_BYTES, 25 * 1024 * 1024)
  })
})
