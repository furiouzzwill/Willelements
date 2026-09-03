'use client'

import { useEffect, useRef, useState } from 'react'

import type { BrandDna } from '@/lib/schemas/brand'
import type { NormalizedEvent } from '@/lib/schemas/event'

/**
 * The live alert runtime.
 *
 * This is the piece that has to behave during a stream, so the rules are
 * different from the rest of the app:
 *
 *  - Alerts **queue**. Five follows in two seconds play one after another
 *    rather than stacking on top of each other. Building this in now is far
 *    cheaper than retrofitting it once the shape assumes one alert at a time.
 *  - Reconnection is `EventSource`'s job, not ours. It retries on its own using
 *    the interval the server sends.
 *  - Nothing is fetched per alert. Colours, fonts and the logo all arrive with
 *    the page, so an alert costs one render and no network.
 */

type Alert = { id: string; event: NormalizedEvent }

const LABELS: Record<string, string> = {
  'channel.follow': 'New follower',
  'channel.subscribe': 'New subscriber',
  'channel.subscription.gift': 'Gift subs',
  'channel.raid': 'Raid',
  'channel.cheer': 'Cheer',
  'stream.online': 'Stream started',
  'stream.offline': 'Stream ended',
}

function subtitle(event: NormalizedEvent): string | null {
  const data = event.data as Record<string, unknown>

  if (event.type === 'channel.raid' && typeof data.viewers === 'number') {
    return `with ${data.viewers.toLocaleString()} viewers`
  }
  if (event.type === 'channel.cheer' && typeof data.bits === 'number') {
    return `${data.bits.toLocaleString()} bits`
  }
  if (event.type === 'channel.subscription.gift' && typeof data.total === 'number') {
    return `${data.total} gifted`
  }
  return null
}

export function AlertLayer({
  token,
  dna,
  logoUrl,
  durationMs = 5000,
}: {
  token: string
  dna: BrandDna
  logoUrl: string | null
  durationMs?: number
}) {
  const [queue, setQueue] = useState<Alert[]>([])
  const [connected, setConnected] = useState(false)
  const seen = useRef(new Set<string>())

  // The alert on screen is simply the head of the queue — derived rather than
  // held in its own state, so the two can never disagree about what is playing.
  const current = queue[0] ?? null

  // One EventSource for the life of the page. The empty dependency list is
  // deliberate: re-creating this would drop the connection on every render.
  useEffect(() => {
    const source = new EventSource(`/api/overlay/${token}/stream`)

    source.addEventListener('hello', () => setConnected(true))

    source.addEventListener('event', (message) => {
      try {
        const payload = JSON.parse((message as MessageEvent).data) as {
          event: NormalizedEvent
        }

        // The server deduplicates too, but a reconnect can replay; two alerts
        // for one follow is worse than none.
        const key = `${payload.event.provider}:${payload.event.providerEventId}`
        if (seen.current.has(key)) return
        seen.current.add(key)

        setQueue((pending) => [...pending, { id: key, event: payload.event }])
      } catch {
        // A malformed frame is skipped rather than breaking the stream.
      }
    })

    // EventSource reconnects by itself; this only reflects it in the UI.
    source.onerror = () => setConnected(false)
    source.onopen = () => setConnected(true)

    return () => source.close()
  }, [token])

  // Retire the current alert after its duration, which promotes the next one.
  useEffect(() => {
    if (!current) return

    const timer = setTimeout(() => setQueue((pending) => pending.slice(1)), durationMs)
    return () => clearTimeout(timer)
  }, [current, durationMs])

  const { colors, typography } = dna

  return (
    <div
      data-overlay-root
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'transparent',
      }}
    >
      {/*
        A small connection dot, only while nothing is playing. It is the
        difference between "my alerts are broken" and "OBS is not connected",
        which is not a diagnosis anyone wants to make mid-stream.
      */}
      {!current ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            width: 8,
            height: 8,
            borderRadius: 999,
            background: connected ? colors.primary : '#ef4444',
            opacity: 0.5,
          }}
        />
      ) : null}

      {current ? (
        <div
          key={current.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            padding: '0 48px',
            textAlign: 'center',
            animation: 'alert-in 420ms cubic-bezier(0.2, 0.9, 0.2, 1)',
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local asset, fixed size
            <img src={logoUrl} alt="" width={96} height={96} style={{ objectFit: 'contain' }} />
          ) : null}

          <div
            style={{
              fontFamily: `${typography.heading}, system-ui, sans-serif`,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: colors.accent,
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
            }}
          >
            {LABELS[current.event.type] ?? current.event.type}
          </div>

          <div
            style={{
              fontFamily: `${typography.heading}, system-ui, sans-serif`,
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.05,
              color: colors.text,
              textShadow: '0 4px 24px rgba(0,0,0,0.7)',
            }}
          >
            {current.event.actor.displayName}
          </div>

          {subtitle(current.event) ? (
            <div
              style={{
                fontFamily: `${typography.body}, system-ui, sans-serif`,
                fontSize: 24,
                color: colors.text,
                opacity: 0.85,
                textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              }}
            >
              {subtitle(current.event)}
            </div>
          ) : null}

          <div
            style={{
              marginTop: 4,
              height: 4,
              width: 200,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`,
              boxShadow: `0 0 24px ${colors.primary}`,
            }}
          />
        </div>
      ) : null}

      <style>{`
        @keyframes alert-in {
          from { opacity: 0; transform: translateY(24px) scale(0.94); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  )
}
