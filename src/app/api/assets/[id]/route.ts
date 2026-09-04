import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'

import { assetPath, getAsset } from '@/lib/services/asset-service'

/**
 * Serves an asset's bytes.
 *
 * Files are looked up by database row, never by a path from the URL, so there
 * is no traversal surface here: the only reachable files are ones this app
 * wrote itself with generated names.
 *
 * Content-addressed filenames mean the bytes at a given asset ID never change,
 * so these are safe to cache hard — which matters for overlays, where a logo
 * should not be refetched on every alert.
 */
export async function GET(request: Request, { params }: RouteContext<'/api/assets/[id]'>) {
  const { id } = await params
  const asset = getAsset(id)

  if (!asset) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const filePath = assetPath(asset)

  let size: number
  try {
    size = (await stat(filePath)).size
  } catch {
    // Row without bytes — the data folder was edited or a copy went wrong.
    return NextResponse.json(
      { error: 'This asset is recorded but its file is missing.' },
      { status: 410 },
    )
  }

  const headers: Record<string, string> = {
    'Content-Type': asset.mimeType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    // Announced for every asset, so a client knows it may ask for a slice.
    'Accept-Ranges': 'bytes',
  }

  const range = parseRange(request.headers.get('range'), size)

  if (range === 'unsatisfiable') {
    return new NextResponse(null, {
      status: 416,
      headers: { ...headers, 'Content-Range': `bytes */${size}` },
    })
  }

  if (range) {
    const length = range.end - range.start + 1
    return new NextResponse(streamOf(filePath, range), {
      status: 206,
      headers: {
        ...headers,
        'Content-Length': String(length),
        'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
      },
    })
  }

  return new NextResponse(streamOf(filePath), {
    headers: { ...headers, 'Content-Length': String(size) },
  })
}

function streamOf(filePath: string, range?: { start: number; end: number }): ReadableStream {
  return Readable.toWeb(createReadStream(filePath, range)) as ReadableStream
}

/**
 * A single byte range, if one was asked for.
 *
 * Video is why this exists. A `<video>` element seeks by asking for a slice of
 * the file, and a server that ignores `Range` and returns the whole thing with
 * a 200 leaves the scrubber unusable — the browser has no way to jump without
 * downloading everything before the point it wants.
 *
 * Only the single-range form is honoured. Multi-range responses need multipart
 * encoding, no browser media element asks for one, and answering with the whole
 * file is a valid response to a range request.
 */
function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header) return null

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null

  const [, rawStart, rawEnd] = match
  if (!rawStart && !rawEnd) return null

  // "bytes=-500" means the last 500 bytes, not "from 0 to 500".
  const start = rawStart ? Number(rawStart) : Math.max(0, size - Number(rawEnd))
  const end = rawStart ? (rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1) : size - 1

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return 'unsatisfiable'
  }

  return { start, end }
}
