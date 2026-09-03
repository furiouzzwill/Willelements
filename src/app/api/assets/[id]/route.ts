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
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/assets/[id]'>,
) {
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

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream

  return new NextResponse(stream, {
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Length': String(size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
