'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { AlertCard, EXIT_MS } from '@/components/alerts/alert-card'
import { ALERT_ANIMATION_CSS } from '@/components/alerts/animations.css'
import { meetsThreshold } from '@/lib/schemas/alert'
import type { OverlayAlertConfig } from '@/lib/services/alert-service'
import type { BrandDna } from '@/lib/schemas/brand'
import type { NormalizedEvent } from '@/lib/schemas/event'

/**
 * The live alert runtime.
 *
 * This is the piece that has to behave during a stream, so the rules differ
 * from the rest of the app:
 *
 *  - Alerts **queue**. Five follows in two seconds play one after another
 *    rather than stacking.
 *  - Reconnection is `EventSource`'s job. It retries on its own using the
 *    interval the server sends.
 *  - Nothing is fetched per alert. Colours, fonts, the logo and every alert
 *    config arrive with the page.
 */

type QueuedAlert = { id: string; event: NormalizedEvent; config: OverlayAlertConfig }

/** How long a dropped connection must persist before it is shown on stream. */
const OFFLINE_GRACE_MS = 6000

export function AlertLayer({
  token,
  dna,
  logoUrl,
  configs,
}: {
  token: string
  dna: BrandDna
  logoUrl: string | null
  configs: OverlayAlertConfig[]
}) {
  const [queue, setQueue] = useState<QueuedAlert[]>([])
  const [leavingId, setLeavingId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [showOffline, setShowOffline] = useState(false)
  const seen = useRef(new Set<string>())

  /**
   * Configs are read inside the stream handler, which must not be torn down and
   * re-subscribed when they change — dropping the connection to pick up a new
   * alert duration would be a poor trade. The ref is synced in an effect rather
   * than during render.
   */
  const configsRef = useRef(configs)
  useEffect(() => {
    configsRef.current = configs
  }, [configs])

  // The alert on screen is the head of the queue — derived rather than held in
  // its own state, so the two can never disagree about what is playing.
  const current = queue[0] ?? null

  // Tracked by id rather than as a boolean, so it resets itself when the next
  // alert is promoted instead of needing to be cleared on every change.
  const leaving = current !== null && leavingId === current.id

  const playSound = useCallback((config: OverlayAlertConfig) => {
    if (!config.soundUrl) return

    const audio = new Audio(config.soundUrl)
    audio.volume = config.spec.volume
    // Autoplay can be refused by a plain browser; OBS allows it. A refused
    // sound must never take the visual alert down with it.
    void audio.play().catch(() => {})
  }, [])

  useEffect(() => {
    const source = new EventSource(`/api/overlay/${token}/stream`)

    const markOnline = () => {
      setConnected(true)
      setShowOffline(false)
    }

    source.addEventListener('hello', markOnline)

    source.addEventListener('event', (message) => {
      try {
        const payload = JSON.parse((message as MessageEvent).data) as {
          event: NormalizedEvent
        }
        const event = payload.event

        // The server deduplicates too, but a reconnect can replay. Two alerts
        // for one follow is worse than none.
        const key = `${event.provider}:${event.providerEventId}`
        if (seen.current.has(key)) return
        seen.current.add(key)

        const config = configsRef.current.find((entry) => entry.eventType === event.type)

        // Eligibility runs before the queue: a disabled alert, or a cheer below
        // its threshold, should never occupy a slot behind a real one.
        if (!config?.enabled) return
        if (!meetsThreshold(event, config.minThreshold)) return

        setQueue((pending) => [...pending, { id: key, event, config }])
      } catch {
        // A malformed frame is skipped rather than breaking the stream.
      }
    })

    source.onopen = markOnline
    source.onerror = () => setConnected(false)

    return () => source.close()
  }, [token])

  // Play the sound as an alert reaches the front of the queue.
  useEffect(() => {
    if (current) playSound(current.config)
  }, [current, playSound])

  // Retire the current alert: run its exit animation, then drop it, which
  // promotes the next one.
  useEffect(() => {
    if (!current) return

    const startExit = setTimeout(() => setLeavingId(current.id), current.config.durationMs)
    const remove = setTimeout(() => {
      setQueue((pending) => pending.slice(1))
    }, current.config.durationMs + EXIT_MS)

    return () => {
      clearTimeout(startExit)
      clearTimeout(remove)
    }
  }, [current])

  /**
   * A dropped connection is only shown after a grace period.
   *
   * EventSource reconnects within seconds, and flashing a warning over the
   * gameplay for every brief blip would be worse than the blip. But a socket
   * that stays dead must be visible — otherwise it looks exactly like a quiet
   * stream, and the first sign of trouble is a viewer asking why alerts stopped.
   */
  useEffect(() => {
    if (connected) return

    const timer = setTimeout(() => setShowOffline(true), OFFLINE_GRACE_MS)
    return () => clearTimeout(timer)
  }, [connected])

  return (
    <div
      data-overlay-root
      data-connected={connected ? 'true' : 'false'}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'transparent',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: ALERT_ANIMATION_CSS }} />

      {/* Connection state, only while nothing is playing so it can never sit
          on top of an alert. */}
      {!current ? (
        showOffline ? (
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.72)',
              border: '1px solid rgba(239,68,68,0.6)',
              color: '#fca5a5',
              fontFamily: 'system-ui, sans-serif',
              fontSize: 13,
              animation: 'we-fade 300ms ease-out both',
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 8, height: 8, borderRadius: 999, background: '#ef4444' }}
            />
            Alerts disconnected — is the app still running?
          </div>
        ) : (
          <span
            aria-hidden="true"
            data-connection-dot
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: connected ? dna.colors.primary : '#eab308',
              opacity: 0.5,
            }}
          />
        )
      ) : null}

      {current ? (
        <AlertCard
          key={current.id}
          event={current.event}
          spec={current.config.spec}
          messageTemplate={current.config.messageTemplate}
          dna={dna}
          logoUrl={logoUrl}
          leaving={leaving}
        />
      ) : null}
    </div>
  )
}
