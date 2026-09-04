import { withAlpha } from '@/lib/hyperframes/color'
import { brandInitial, escapeHtml, fitFontSize } from '@/lib/hyperframes/html'
import type { VisualIdentity } from '@/lib/hyperframes/identity'
import { composeDocument, decorativeLayers } from '@/lib/hyperframes/templates/shell'
import { seconds, type CompositionTemplate } from '@/lib/hyperframes/templates/types'

/**
 * The animated logo — the first composition a brand should have.
 *
 * One shot, no loop: it plays at the top of a stream, between segments, or over
 * a transition, and then it is done. Everything about its timing comes from the
 * brand's motion DNA, so two brands never get the same sting with different
 * colours poured in.
 */

/**
 * The rhythm, as beat numbers rather than seconds.
 *
 * A beat is derived from the brand's own base duration and stagger, so a slow
 * cinematic brand gets a sting that breathes and a fast one gets a snap — the
 * same choreography either way, retimed rather than rewritten.
 */
const BEATS = { mark: 0, wordmark: 1, rule: 1.6, subhead: 2.2 } as const

const LEAD_IN = 0.1

/** How long the finished frame holds before the clip ends. */
const HOLD = 1.2

function beat(identity: VisualIdentity, count: number): number {
  const { duration, stagger } = identity.motion
  return seconds(LEAD_IN + duration.base * count * 0.5 + stagger * count)
}

/**
 * When the last element has finished arriving.
 *
 * Always measured to the tagline's beat, whether or not there is a tagline: the
 * duration is decided before the text is known, and a sting whose length
 * changed when you typed into an optional field would be worse than one that is
 * a fraction long without it.
 */
function entranceEnd(identity: VisualIdentity): number {
  return beat(identity, BEATS.subhead) + identity.motion.duration.base
}

export const logoSting: CompositionTemplate = {
  id: 'logo-sting',
  name: 'Animated logo',
  summary: 'Your mark and wordmark assembling on brand, then holding.',
  usage: 'Open a stream with it, or drop it on a transition between scenes.',
  width: 1920,
  height: 1080,
  format: 'mp4',
  loops: false,
  usesLogo: true,
  headline: {
    label: 'Wordmark',
    hint: 'Defaults to your brand name.',
    max: 40,
  },
  subhead: {
    label: 'Tagline',
    hint: 'Optional. Leave it empty and the sting ends on the wordmark.',
    max: 60,
  },

  duration(identity) {
    // Clamped at both ends: under two and a half seconds nobody registers it,
    // and past six it stops being a sting and starts being a wait.
    return seconds(Math.max(2.5, Math.min(6, entranceEnd(identity) + HOLD)))
  },

  defaults(brandName) {
    return { headline: brandName, subhead: '' }
  },

  build(context) {
    const { identity, input, logoSrc, width, height, durationSeconds } = context
    const { motion, colors } = identity

    const headline = input.headline.trim() || context.brandName
    const subhead = input.subhead.trim()

    const wordmarkSize = fitFontSize(headline, { max: 132, min: 52, maxWidth: 1180 })
    const mark = logoSrc
      ? `<img id="mark" class="mark mark-image" src="${escapeHtml(logoSrc)}" alt="" />`
      : `<div id="mark" class="mark mark-letter">${escapeHtml(brandInitial(headline))}</div>`

    const timeline: string[] = [
      `tl.from("#mark", { scale: 0.62, opacity: 0, duration: ${motion.duration.base}, ease: "${motion.ease.entrance}" }, ${beat(identity, BEATS.mark)})`,
      `  .from("#wordmark", { y: ${motion.travel}, opacity: 0, duration: ${motion.duration.base}, ease: "${motion.ease.entrance}" }, ${beat(identity, BEATS.wordmark)})`,
      `  .from("#rule", { scaleX: 0, opacity: 0, duration: ${motion.duration.base}, ease: "${motion.ease.entrance}" }, ${beat(identity, BEATS.rule)});`,
    ]

    if (subhead) {
      timeline.push(
        `tl.from("#tagline", { y: ${Math.round(motion.travel * 0.45)}, opacity: 0, duration: ${motion.duration.quick}, ease: "${motion.ease.entrance}" }, ${beat(identity, BEATS.subhead)});`,
      )
    }

    if (motion.accents.glitch) {
      // A short chromatic stutter on the mark only. Stepped easing is what
      // makes it read as a glitch rather than a wobble.
      timeline.push(
        `tl.to("#mark", { x: ${Math.round(motion.travel * 0.14)}, duration: ${motion.duration.quick}, ease: "${motion.ease.emphasis}", yoyo: true, repeat: 3 }, ${seconds(LEAD_IN + motion.duration.base * 0.6)});`,
      )
    }

    if (motion.accents.bloom) {
      timeline.push(
        `tl.from("#glow", { opacity: 0, scale: 0.7, duration: ${motion.duration.slow}, ease: "${motion.ease.entrance}" }, 0);`,
      )
    }

    return composeDocument({
      compositionId: 'main',
      title: `${escapeHtml(headline)} — logo sting`,
      width,
      height,
      durationSeconds,
      transparent: false,
      identity,
      styles: `
        .stack {
          display: grid;
          justify-items: center;
          gap: 34px;
          width: 1400px;
          text-align: center;
        }

        .mark {
          width: 220px;
          height: 220px;
          display: grid;
          place-items: center;
        }

        .mark-letter {
          border-radius: var(--hf-radius);
          background: linear-gradient(140deg, var(--hf-primary), var(--hf-secondary));
          color: var(--hf-on-primary);
          font-family: var(--hf-font-heading);
          font-weight: var(--hf-weight-heading);
          font-size: 128px;
          line-height: 1;
        }

        .mark-image {
          object-fit: contain;
        }

        #wordmark {
          font-size: ${wordmarkSize}px;
          color: var(--hf-text);
          max-width: 1400px;
        }

        #rule {
          width: 420px;
          height: var(--hf-hairline);
          background: linear-gradient(90deg, transparent, var(--hf-accent-readable), transparent);
          transform-origin: center;
        }

        #tagline {
          margin: 0;
          font-size: 34px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--hf-muted);
        }

        #glow {
          background: radial-gradient(
            circle at 50% 42%,
            ${withAlpha(colors.accent, 0.3)} 0%,
            transparent 55%
          );
        }
      `,
      body: `
        ${decorativeLayers(identity)}
        ${motion.accents.bloom ? '<div id="glow" class="layer" aria-hidden="true"></div>' : ''}
        <section id="sting" class="clip" data-start="0" data-duration="${durationSeconds}">
          <div class="stack">
            ${mark}
            <h1 id="wordmark" class="heading">${escapeHtml(headline)}</h1>
            <div id="rule"></div>
            ${subhead ? `<p id="tagline">${escapeHtml(subhead)}</p>` : ''}
          </div>
        </section>
      `,
      timeline: timeline.join('\n'),
    })
  },
}
