'use client'

import type { CSSProperties } from 'react'

import type { AlertSpec } from '@/lib/schemas/alert'
import { renderTemplate, templateValuesFor } from '@/lib/schemas/alert'
import type { BrandDna } from '@/lib/schemas/brand'
import type { NormalizedEvent } from '@/lib/schemas/event'

/**
 * The alert itself.
 *
 * Used by both the OBS runtime and the editor preview, so what you configure is
 * literally what plays — not a mock-up that drifts from it. Every value comes in
 * as a prop; this component reads no context and fetches nothing.
 */

const ENTRANCE: Record<string, string> = {
  fade: 'we-fade',
  scale: 'we-scale',
  'slide-up': 'we-slide-up',
  'slide-down': 'we-slide-down',
  glitch: 'we-glitch',
  wipe: 'we-wipe',
}

const EXIT: Record<string, string> = {
  fade: 'we-out-fade',
  scale: 'we-out-scale',
  'slide-up': 'we-out-slide-up',
  'slide-down': 'we-out-slide-down',
}

const ENTRANCE_MS = 480
const EXIT_MS = 320

const ALIGNMENT: Record<AlertSpec['layout'], CSSProperties> = {
  centered: { alignItems: 'center', textAlign: 'center' },
  left: { alignItems: 'flex-start', textAlign: 'left' },
  right: { alignItems: 'flex-end', textAlign: 'right' },
  banner: { alignItems: 'center', textAlign: 'center' },
}

/**
 * Reveals a line one word at a time, staggered.
 *
 * Each word carries its own trailing space rather than relying on a CSS gap.
 * A gap looks identical on screen but leaves the element's text as
 * "WELCOMEIN" — wrong for a screen reader, wrong when copied, and wrong for
 * anything reading the page.
 */
function WordReveal({ text, style }: { text: string; style: CSSProperties }) {
  const words = text.split(/\s+/).filter(Boolean)

  return (
    <span style={style}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          style={{
            display: 'inline-block',
            animation: `we-word 360ms cubic-bezier(0.2,0.9,0.2,1) both`,
            animationDelay: `${120 + index * 70}ms`,
          }}
        >
          {word}
          {index < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </span>
  )
}

function elementAnimation(animation: string, delayMs: number): CSSProperties {
  if (animation === 'none') return {}

  const name = animation === 'scale' ? 'we-scale' : 'we-fade'
  return {
    animation: `${name} 420ms cubic-bezier(0.2,0.9,0.2,1) both`,
    animationDelay: `${delayMs}ms`,
  }
}

export function AlertCard({
  event,
  spec,
  messageTemplate,
  dna,
  logoUrl,
  /** Set once the alert is retiring, so the exit animation runs. */
  leaving = false,
}: {
  event: NormalizedEvent
  spec: AlertSpec
  messageTemplate: string
  dna: BrandDna
  logoUrl: string | null
  leaving?: boolean
}) {
  const { colors, typography } = dna
  const label = spec.elements.find((element) => element.type === 'label')
  const message = renderTemplate(messageTemplate, templateValuesFor(event))

  const usernameAnimation =
    spec.elements.find((element) => element.type === 'username')?.animation ?? 'fade'
  const logoAnimation =
    spec.elements.find((element) => element.type === 'logo')?.animation ?? 'scale'

  const isBanner = spec.layout === 'banner'

  return (
    <div
      className="we-alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isBanner ? 6 : 12,
        padding: isBanner ? '18px 40px' : '0 48px',
        // A banner needs a surface behind it; the other layouts sit on the
        // stream itself and rely on text shadow for contrast.
        background: isBanner ? `${colors.background}e6` : 'transparent',
        borderRadius: isBanner ? 14 : 0,
        border: isBanner ? `1px solid ${colors.primary}55` : 'none',
        animation: leaving
          ? `${EXIT[spec.exit] ?? 'we-out-fade'} ${EXIT_MS}ms ease-in both`
          : `${ENTRANCE[spec.entrance] ?? 'we-fade'} ${ENTRANCE_MS}ms cubic-bezier(0.2,0.9,0.2,1) both`,
        ...ALIGNMENT[spec.layout],
      }}
    >
      {spec.showLogo && logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local asset, fixed size
        <img
          src={logoUrl}
          alt=""
          width={isBanner ? 48 : 96}
          height={isBanner ? 48 : 96}
          style={{ objectFit: 'contain', ...elementAnimation(logoAnimation, 60) }}
        />
      ) : null}

      {label ? (
        <div
          style={{
            fontFamily: `${typography.heading}, system-ui, sans-serif`,
            fontSize: isBanner ? 14 : 20,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: colors.accent,
            textShadow: isBanner ? 'none' : '0 2px 12px rgba(0,0,0,0.65)',
          }}
        >
          {label.animation === 'word-reveal' && 'value' in label ? (
            <WordReveal text={label.value} style={{}} />
          ) : (
            <span style={elementAnimation(label.animation, 120)}>
              {'value' in label ? label.value : ''}
            </span>
          )}
        </div>
      ) : null}

      <div
        style={{
          fontFamily: `${typography.heading}, system-ui, sans-serif`,
          fontSize: isBanner ? 28 : 64,
          fontWeight: 700,
          lineHeight: 1.05,
          color: colors.text,
          textShadow: isBanner ? 'none' : '0 4px 24px rgba(0,0,0,0.75)',
          ...elementAnimation(usernameAnimation, 220),
        }}
      >
        {message}
      </div>

      <div
        aria-hidden="true"
        style={{
          marginTop: 4,
          height: 4,
          width: isBanner ? 120 : 200,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`,
          boxShadow: `0 0 24px ${colors.primary}`,
          ...elementAnimation('fade', 300),
        }}
      />
    </div>
  )
}

export { ENTRANCE_MS, EXIT_MS }
