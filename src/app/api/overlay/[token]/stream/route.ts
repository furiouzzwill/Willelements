import { subscribe, type OverlayMessage } from '@/lib/events/bus'
import { getOverlayByToken } from '@/lib/services/overlay-service'

/**
 * The overlay's event stream.
 *
 * Server-Sent Events rather than a WebSocket: the overlay only ever receives,
 * and the browser's `EventSource` reconnects on its own. A browser source that
 * sat untouched in OBS for a week comes back without a line of reconnect logic
 * of ours — which is exactly the kind of code that is hard to get right and
 * expensive to get wrong during a live stream.
 *
 * Authenticated by the overlay token in the path. Nothing here reads a cookie,
 * so the stream is unaffected by anything happening in the dashboard.
 */

export const dynamic = 'force-dynamic'

/**
 * OBS keeps a browser source open indefinitely, and anything in between can
 * drop a connection that looks idle. A comment line every 20s keeps it alive
 * and costs nothing.
 */
const HEARTBEAT_MS = 20_000

export async function GET(
  request: Request,
  { params }: RouteContext<'/api/overlay/[token]/stream'>,
) {
  const { token } = await params
  const overlay = getOverlayByToken(token)

  if (!overlay) {
    return new Response('Unknown overlay', { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true

      const write = (chunk: string) => {
        if (!open) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          open = false
        }
      }

      const send = (message: OverlayMessage) => {
        write(`event: ${message.kind}\ndata: ${JSON.stringify(message)}\n\n`)
      }

      // Tell the overlay it is connected before anything else happens, so it
      // can show a connected state rather than guessing from silence.
      // `retry` sets how long EventSource waits before reconnecting.
      write('retry: 2000\n\n')
      send({ kind: 'hello', overlayId: overlay.id })

      const unsubscribe = subscribe({ overlayId: overlay.id, send })

      const heartbeat = setInterval(() => write(`: ping\n\n`), HEARTBEAT_MS)

      const close = () => {
        if (!open) return
        open = false
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // Already closed by the client going away.
        }
      }

      // OBS closing the source, or the scene changing, aborts the request.
      request.signal.addEventListener('abort', close)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      // Belt and braces for any proxy that would otherwise buffer the stream
      // and deliver alerts in a batch, seconds late.
      'X-Accel-Buffering': 'no',
    },
  })
}
