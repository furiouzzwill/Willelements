/**
 * Runs once when the server starts.
 *
 * Everything here is started and deliberately **not awaited**. `register()` has
 * to complete before the server accepts requests, so anything slow — an
 * unreachable Twitch, an npx download for the renderer — would otherwise delay
 * the dashboard from loading.
 *
 * The one exception is closing out interrupted renders, which is a single
 * synchronous UPDATE and has to happen before a page can read those rows.
 */
export async function register() {
  // Only the Node runtime can hold a WebSocket or spawn a process; the edge
  // runtime cannot, and `next build` sets neither.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const [{ startTwitchListener }, { recoverInterruptedRenders }, { probeToolchain }] =
    await Promise.all([
      import('@/lib/providers/twitch/eventsub'),
      import('@/lib/services/render-service'),
      import('@/lib/hyperframes/toolchain'),
    ])

  // A render's child process died with the previous server. Its row would
  // otherwise sit at "processing" forever, showing a bar that cannot move.
  recoverInterruptedRenders()

  void startTwitchListener().catch((error) => {
    console.error('[twitch] listener failed to start:', error)
  })

  // Warm the render toolchain probe so the animations page has an answer ready
  // instead of asking the question while someone is waiting on it.
  void probeToolchain().catch((error) => {
    console.error('[hyperframes] toolchain probe failed:', error)
  })
}
