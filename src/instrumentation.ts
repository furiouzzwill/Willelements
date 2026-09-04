/**
 * Runs once when the server starts.
 *
 * This is where the Twitch listener is brought up. `register()` must complete
 * before the server accepts requests, so the connection is started but
 * deliberately **not awaited** — a slow or unreachable Twitch must never delay
 * the dashboard from loading.
 */
export async function register() {
  // Only the Node runtime can hold a WebSocket; the edge runtime cannot, and
  // `next build` sets neither.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { startTwitchListener } = await import('@/lib/providers/twitch/eventsub')

  void startTwitchListener().catch((error) => {
    console.error('[twitch] listener failed to start:', error)
  })
}
