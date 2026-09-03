import { NextResponse } from 'next/server'

import { exportBackup } from '@/lib/services/backup-service'

/** Downloads a zip of the database and every asset file. */
export async function GET() {
  const { fileName, bytes } = await exportBackup()

  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'no-store',
    },
  })
}
