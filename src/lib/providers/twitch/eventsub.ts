import 'server-only'

import {
  normalizeTwitchEvent,
  notificationMessage,
  type TwitchNotification,
} from '@/lib/providers/twitch/normalize'
import {
  conditionFor,
  missingScopes,
  subscriptionsFor,
  type SubscriptionDefinition,
} from '@/lib/providers/twitch/subscriptions'
import {
  ReconnectRequiredError,
  getAccessToken,
  getAccount,
} from '@/lib/services/connected-account-service'
import { recordEvent } from '@/lib/services/event-service'

/**
 * The Twitch EventSub client.
 *
 * **WebSocket, not webhooks.** Webhook delivery needs a public HTTPS URL, which
 * a machine on a home network does not have; using them would mean running a
 * tunnel and depending on it while live. Here the app dials out to Twitch and
 * receives events on that connection — no inbound port, no tunnel, no
 * certificate.
 *
 * Protocol details verified against dev.twitch.tv:
 *  - `wss://eventsub.wss.twitch.tv/ws`, with an optional keepalive timeout
 *  - Subscriptions must be created within **10 seconds** of the welcome message
 *    or Twitch closes the connection
 *  - On `session_reconnect`, connect to the supplied URL and do not close the
 *    old socket until the new one sends its own welcome
 *
 * This connection is the difference between alerts working and not working
 * during a stream, so every failure path here ends in either a retry or a
 * state the UI can show — never a silent stop.
 */

const WS_URL = 'wss://eventsub.wss.twitch.tv/ws'
const HELIX_SUBSCRIPTIONS = 'https://api.twitch.tv/helix/eventsub/subscriptions'

/** Twitch's allowed range is 10–600s. A shorter timeout detects death sooner. */
const KEEPALIVE_SECONDS = 30

/**
 * How long past the keepalive interval to wait before assuming the socket is
 * dead. Twitch sends a keepalive whenever nothing else has arrived, so silence
 * beyond this means the connection is gone even if the socket has not noticed.
 */
const WATCHDOG_MARGIN_MS = 10_000

const BASE_BACKOFF_MS = 2_000
const MAX_BACKOFF_MS = 60_000

export type ListenerStatus = {
  state: 'stopped' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  since: string
  /** Event types successfully subscribed to. */
  subscribed: string[]
  /** Types we could not subscribe to, and the scope each needs. */
  unavailable: { eventType: string; scope: string }[]
  lastEventAt: string | null
  lastError: string | null
  attempts: number
}

type State = {
  socket: WebSocket | null
  status: ListenerStatus
  watchdog: ReturnType<typeof setTimeout> | null
  retry: ReturnType<typeof setTimeout> | null
  /** Set while a session_reconnect handoff is in flight. */
  replacing: boolean
  stopped: boolean
}

/**
 * Held on `globalThis` so hot reload in development does not leave an orphaned
 * socket delivering events to a dead module.
 */
const globalForListener = globalThis as unknown as { __willelementsTwitch?: State }

function state(): State {
  if (!globalForListener.__willelementsTwitch) {
    globalForListener.__willelementsTwitch = {
      socket: null,
      status: {
        state: 'stopped',
        since: new Date().toISOString(),
        subscribed: [],
        unavailable: [],
        lastEventAt: null,
        lastError: null,
        attempts: 0,
      },
      watchdog: null,
      retry: null,
      replacing: false,
      stopped: true,
    }
  }
  return globalForListener.__willelementsTwitch
}

export function getListenerStatus(): ListenerStatus {
  return { ...state().status }
}

function setStatus(update: Partial<ListenerStatus>) {
  const current = state()
  current.status = { ...current.status, ...update, since: new Date().toISOString() }
}

function log(message: string, ...rest: unknown[]) {
  console.log(`[twitch] ${message}`, ...rest)
}

function clearTimers() {
  const current = state()
  if (current.watchdog) clearTimeout(current.watchdog)
  if (current.retry) clearTimeout(current.retry)
  current.watchdog = null
  current.retry = null
}

/**
 * Resets the silence watchdog.
 *
 * A socket can stay open while the connection behind it is gone — a laptop
 * waking from sleep is the common case. Twitch guarantees a keepalive when
 * nothing else arrives, so silence past the interval is a dead connection
 * regardless of what the socket says.
 */
function armWatchdog() {
  const current = state()
  if (current.watchdog) clearTimeout(current.watchdog)

  current.watchdog = setTimeout(() => {
    log('no keepalive within the expected window — treating the connection as dead')
    current.socket?.close()
  }, KEEPALIVE_SECONDS * 1000 + WATCHDOG_MARGIN_MS)
}

/** Creates one subscription. Returns false when Twitch refuses it. */
async function createSubscription(
  definition: SubscriptionDefinition,
  options: { sessionId: string; accessToken: string; clientId: string; broadcasterId: string },
): Promise<boolean> {
  const response = await fetch(HELIX_SUBSCRIPTIONS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Client-Id': options.clientId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: definition.type,
      version: definition.version,
      condition: conditionFor(definition, options.broadcasterId),
      transport: { method: 'websocket', session_id: options.sessionId },
    }),
  })

  if (response.ok) return true

  // Never log the body verbatim — it echoes request context back.
  log(`could not subscribe to ${definition.type} (${response.status})`)
  return false
}

/**
 * Creates every subscription this token is allowed to.
 *
 * Twitch closes the connection if nothing is subscribed within ten seconds of
 * the welcome, so these are fired together rather than in sequence.
 */
async function subscribeAll(sessionId: string) {
  const account = getAccount('twitch')
  if (!account) return

  const { accessToken, clientId } = await getAccessToken('twitch')
  const allowed = subscriptionsFor(account.scopes)

  const results = await Promise.all(
    allowed.map(async (definition) => ({
      definition,
      ok: await createSubscription(definition, {
        sessionId,
        accessToken,
        clientId,
        broadcasterId: account.providerUserId,
      }),
    })),
  )

  const subscribed = results.filter((r) => r.ok).map((r) => r.definition.eventType)
  const unavailable = missingScopes(account.scopes)

  setStatus({ state: 'connected', subscribed, unavailable, attempts: 0, lastError: null })

  log(
    `listening for ${subscribed.length} event ${subscribed.length === 1 ? 'type' : 'types'}` +
      (unavailable.length > 0 ? ` (${unavailable.length} need more permissions)` : ''),
  )
}

function handleNotification(raw: unknown) {
  const parsed = notificationMessage.safeParse(raw)
  if (!parsed.success) return

  const message: TwitchNotification = parsed.data
  const event = normalizeTwitchEvent(message)

  if (!event) {
    log(`ignoring unhandled subscription type ${message.metadata.subscription_type}`)
    return
  }

  const { isNew, delivered } = recordEvent(event)
  setStatus({ lastEventAt: new Date().toISOString() })

  if (isNew) {
    log(`${event.type} from ${event.actor.displayName} → ${delivered} overlay(s)`)
  }
}

function connect(url: string, isReplacement = false) {
  const current = state()
  current.stopped = false

  const target = new URL(url)
  if (!target.searchParams.has('keepalive_timeout_seconds')) {
    target.searchParams.set('keepalive_timeout_seconds', String(KEEPALIVE_SECONDS))
  }

  if (!isReplacement) setStatus({ state: 'connecting' })

  const socket = new WebSocket(target.toString())

  socket.addEventListener('message', (message) => {
    armWatchdog()

    let payload: {
      metadata?: { message_type?: string }
      payload?: { session?: { id?: string; reconnect_url?: string } }
    }

    try {
      payload = JSON.parse(String(message.data))
    } catch {
      return
    }

    switch (payload.metadata?.message_type) {
      case 'session_welcome': {
        const sessionId = payload.payload?.session?.id
        if (!sessionId) break

        if (isReplacement) {
          // The handoff succeeded: the old socket can go, and its
          // subscriptions carry over to this session automatically.
          const old = current.socket
          current.socket = socket
          current.replacing = false
          old?.close()
          setStatus({ state: 'connected' })
          log('reconnect complete')
          break
        }

        current.socket = socket
        void subscribeAll(sessionId).catch((error) => {
          const message =
            error instanceof ReconnectRequiredError
              ? error.message
              : 'Could not create Twitch subscriptions.'
          setStatus({ state: 'error', lastError: message })
          log(message)
        })
        break
      }

      case 'session_keepalive':
        // The watchdog was already reset above; nothing else to do.
        break

      case 'notification':
        handleNotification(payload)
        break

      case 'session_reconnect': {
        const reconnectUrl = payload.payload?.session?.reconnect_url
        if (!reconnectUrl) break

        // Connect to the new URL and keep the old socket until the replacement
        // sends its welcome — closing early would drop events in the gap.
        log('Twitch asked us to reconnect')
        current.replacing = true
        setStatus({ state: 'reconnecting' })
        connect(reconnectUrl, true)
        break
      }

      case 'revocation': {
        log('a subscription was revoked — reconnect Twitch to restore it')
        setStatus({
          state: 'error',
          lastError: 'Twitch revoked a subscription. Reconnect the platform.',
        })
        break
      }
    }
  })

  socket.addEventListener('close', () => {
    // A socket being replaced closing is the expected end of a handoff.
    if (isReplacement || current.replacing) return
    if (current.stopped) return

    scheduleReconnect()
  })

  socket.addEventListener('error', () => {
    // 'close' always follows, and that is where the retry lives.
    setStatus({ lastError: 'The Twitch connection dropped.' })
  })
}

/**
 * Reconnects with exponential backoff.
 *
 * Capped at a minute: a creator whose network came back should not wait ten
 * minutes for alerts to resume, and Twitch is not helped by us retrying faster.
 */
function scheduleReconnect() {
  const current = state()
  const attempts = current.status.attempts + 1
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS)

  setStatus({ state: 'reconnecting', attempts })
  log(`reconnecting in ${Math.round(delay / 1000)}s (attempt ${attempts})`)

  current.retry = setTimeout(() => {
    if (!current.stopped) connect(WS_URL)
  }, delay)
}

/**
 * Starts listening, if a Twitch account is connected.
 *
 * Safe to call more than once — a second call while already running is ignored.
 */
export async function startTwitchListener(): Promise<void> {
  const current = state()

  if (current.socket || current.status.state === 'connecting') return
  if (!getAccount('twitch')) {
    log('no Twitch account connected — not starting the listener')
    return
  }

  try {
    // Fail fast on an unusable token rather than opening a socket that cannot
    // subscribe to anything.
    await getAccessToken('twitch')
  } catch (error) {
    const message =
      error instanceof ReconnectRequiredError
        ? error.message
        : 'Could not reach Twitch to start the listener.'
    setStatus({ state: 'error', lastError: message })
    log(message)
    return
  }

  connect(WS_URL)
}

/** Stops listening and cancels any pending retry. */
export function stopTwitchListener(): void {
  const current = state()
  current.stopped = true
  clearTimers()
  current.socket?.close()
  current.socket = null
  setStatus({ state: 'stopped', subscribed: [], attempts: 0 })
}

/** Stops and starts — used after connecting or reconnecting an account. */
export async function restartTwitchListener(): Promise<void> {
  stopTwitchListener()
  await startTwitchListener()
}
