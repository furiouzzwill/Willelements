import 'server-only'

import type { NormalizedEvent } from '@/lib/schemas/event'

/**
 * In-process event delivery to connected overlays.
 *
 * Everything runs in one Node process on one machine, so this is a plain
 * subscriber list rather than a message broker. That is not a shortcut — it is
 * the whole reason the local architecture has lower alert latency than a hosted
 * one: an event goes from the Twitch client to the browser source without
 * leaving the machine.
 *
 * Subscribers are held on `globalThis` so hot reload in development does not
 * orphan an OBS browser source that is still connected.
 */

export type OverlayMessage =
  | { kind: 'event'; event: NormalizedEvent }
  | { kind: 'hello'; overlayId: string }

type Subscriber = {
  overlayId: string
  send: (message: OverlayMessage) => void
}

const globalForBus = globalThis as unknown as {
  __willelementsSubscribers?: Set<Subscriber>
}

function subscribers(): Set<Subscriber> {
  if (!globalForBus.__willelementsSubscribers) {
    globalForBus.__willelementsSubscribers = new Set()
  }
  return globalForBus.__willelementsSubscribers
}

/** Registers an overlay connection. The returned function disconnects it. */
export function subscribe(subscriber: Subscriber): () => void {
  const set = subscribers()
  set.add(subscriber)
  return () => set.delete(subscriber)
}

/**
 * Delivers an event to overlays.
 *
 * Returns how many connections received it, which is what lets the dashboard
 * tell you "no overlay is connected" instead of silently doing nothing when you
 * press Test Alert with OBS closed.
 *
 * A throwing subscriber is dropped rather than allowed to break delivery for
 * the others — one wedged browser source must not take the rest down.
 */
export function publish(event: NormalizedEvent, overlayId?: string): number {
  const message: OverlayMessage = { kind: 'event', event }
  let delivered = 0

  for (const subscriber of subscribers()) {
    if (overlayId && subscriber.overlayId !== overlayId) continue

    try {
      subscriber.send(message)
      delivered += 1
    } catch {
      subscribers().delete(subscriber)
    }
  }

  return delivered
}

/** How many overlays are currently connected, optionally for one overlay. */
export function connectionCount(overlayId?: string): number {
  if (!overlayId) return subscribers().size

  let count = 0
  for (const subscriber of subscribers()) {
    if (subscriber.overlayId === overlayId) count += 1
  }
  return count
}
