'use client'

import { useSyncExternalStore, type CSSProperties } from 'react'

import type { WidgetData } from '@/components/widgets/widget-data'
import type { BrandDna } from '@/lib/schemas/brand'
import type { OverlayWidgetModel } from '@/lib/schemas/overlay'

/**
 * Renders one widget.
 *
 * Used by the editor canvas and the OBS runtime alike, so the editor cannot
 * show you something different from what goes on stream. Every value arrives as
 * a prop — this fetches nothing and reads no context.
 *
 * `alert-box` renders as an outline in the editor and as nothing at all in the
 * runtime: it marks *where* alerts appear rather than drawing anything itself.
 */

function textShadow(editing: boolean) {
  // On stream the text sits over gameplay and needs the shadow; in the editor
  // it sits on a flat panel where the shadow just muddies it.
  return editing ? 'none' : '0 2px 12px rgba(0,0,0,0.7)'
}

function Stack({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: '100%',
        gap: 6,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/**
 * The current second, as a stable value.
 *
 * `useSyncExternalStore` is the right tool here rather than an effect: the
 * clock is an external, mutable source, and this is what makes the server and
 * the browser agree on the first render instead of hydrating a mismatch.
 */
function subscribeToSeconds(onChange: () => void) {
  const timer = setInterval(onChange, 1000)
  return () => clearInterval(timer)
}

/** Bucketed to the second so the snapshot is stable between ticks. */
const currentSecond = () => Math.floor(Date.now() / 1000)

/** The server has no clock worth showing; it renders a placeholder. */
const noSecond = () => 0

function Clock({ format, style }: { format: '12h' | '24h'; style: CSSProperties }) {
  const second = useSyncExternalStore(subscribeToSeconds, currentSecond, noSecond)

  const text =
    second === 0
      ? '--:--'
      : new Date(second * 1000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: format === '12h',
        })

  return <div style={style}>{text}</div>
}

export function WidgetRenderer({
  widget,
  dna,
  data,
  logoUrl,
  /** True in the editor, where the widget sits on a panel rather than a stream. */
  editing = false,
}: {
  widget: OverlayWidgetModel
  dna: BrandDna
  data: WidgetData
  logoUrl: string | null
  editing?: boolean
}) {
  const { colors, typography } = dna
  const config = widget.config

  const heading: CSSProperties = {
    fontFamily: `${typography.heading}, system-ui, sans-serif`,
    color: colors.text,
    textShadow: textShadow(editing),
  }

  const label: CSSProperties = {
    fontFamily: `${typography.heading}, system-ui, sans-serif`,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: colors.accent,
    textShadow: textShadow(editing),
  }

  switch (config.type) {
    case 'alert-box':
      // Marks where alerts appear. Invisible on stream by design.
      return editing ? (
        <div
          style={{
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            border: `2px dashed ${colors.accent}`,
            borderRadius: 12,
            color: colors.accent,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 16,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.8,
          }}
        >
          Alerts appear here
        </div>
      ) : null

    case 'text':
      return (
        <Stack>
          <div
            style={{
              ...heading,
              fontSize: config.fontSize,
              textAlign: config.align,
              color: config.color || colors.text,
              fontWeight: 600,
            }}
          >
            {config.value}
          </div>
        </Stack>
      )

    case 'image': {
      const src = config.assetId ? `/api/assets/${config.assetId}` : logoUrl
      if (!src) {
        return editing ? (
          <div
            style={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              border: `2px dashed ${colors.accent}`,
              borderRadius: 12,
              color: colors.accent,
              fontFamily: 'system-ui, sans-serif',
              fontSize: 14,
            }}
          >
            No image chosen
          </div>
        ) : null
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element -- local asset route
        <img
          src={src}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: config.fit,
            opacity: config.opacity,
          }}
        />
      )
    }

    case 'latest-follower':
    case 'latest-subscriber': {
      const value =
        config.type === 'latest-follower' ? data.latestFollower : data.latestSubscriber

      return (
        <Stack>
          <div style={label}>{config.label}</div>
          <div style={{ ...heading, fontSize: config.fontSize, fontWeight: 700 }}>
            {/* An em dash rather than a blank: an empty widget looks broken. */}
            {value ?? '—'}
          </div>
        </Stack>
      )
    }

    case 'recent-events':
      return (
        <Stack style={{ justifyContent: 'flex-start', gap: 8 }}>
          <div style={label}>{config.label}</div>
          {data.recent.length === 0 ? (
            <div
              style={{
                ...heading,
                fontSize: config.fontSize,
                opacity: 0.5,
                fontFamily: `${typography.body}, system-ui, sans-serif`,
              }}
            >
              Nothing yet
            </div>
          ) : (
            data.recent.slice(0, config.limit).map((entry, index) => (
              <div
                key={`${entry.name}-${entry.at}-${index}`}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'baseline',
                  fontFamily: `${typography.body}, system-ui, sans-serif`,
                  fontSize: config.fontSize,
                  color: colors.text,
                  textShadow: textShadow(editing),
                }}
              >
                <span style={{ color: colors.accent, fontSize: config.fontSize * 0.7 }}>
                  {entry.label}
                </span>
                <span>{entry.name}</span>
              </div>
            ))
          )}
        </Stack>
      )

    case 'follower-goal': {
      const current = data.followerCount ?? 0
      const progress = Math.max(0, Math.min(1, current / config.target))

      return (
        <Stack style={{ gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={label}>{config.label}</span>
            <span
              style={{
                ...heading,
                fontSize: config.fontSize,
                fontWeight: 700,
              }}
            >
              {data.followerCount === null
                ? '—'
                : `${current.toLocaleString()} / ${config.target.toLocaleString()}`}
            </span>
          </div>
          <div
            style={{
              height: 12,
              borderRadius: 999,
              background: `${colors.text}22`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress * 100}%`,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`,
                transition: 'width 600ms cubic-bezier(0.2,0.9,0.2,1)',
              }}
            />
          </div>
        </Stack>
      )
    }

    case 'clock':
      return (
        <Stack>
          <Clock
            format={config.format}
            style={{ ...heading, fontSize: config.fontSize, fontWeight: 700 }}
          />
        </Stack>
      )

    default:
      // A type in the registry that the runtime cannot draw yet.
      return editing ? (
        <div
          style={{
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            border: `2px dashed ${colors.accent}`,
            borderRadius: 12,
            color: colors.accent,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 14,
          }}
        >
          Not available yet
        </div>
      ) : null
  }
}
