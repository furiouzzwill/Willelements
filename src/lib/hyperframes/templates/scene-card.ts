import { withAlpha } from '@/lib/hyperframes/color'
import { escapeHtml, fitFontSize } from '@/lib/hyperframes/html'
import { composeDocument, decorativeLayers } from '@/lib/hyperframes/templates/shell'
import { seconds, type CompositionTemplate } from '@/lib/hyperframes/templates/types'

/**
 * The full-frame scene card — Starting Soon, Be Right Back, Stream Ending.
 *
 * One template rather than three, because the difference between them is the
 * words on the card and nothing else. Three near-identical templates would be
 * three places to fix the same bug.
 *
 * **It loops seamlessly, and that constraint shapes the whole design.** This
 * plays in OBS as a looping media source, so a frame that does not continue
 * into frame zero shows up as a visible jump every few seconds. That rules out
 * entrance animations: there is nothing to enter from when the clip restarts.
 * Every tween here is therefore cyclic — a full rotation, or a yoyo running an
 * even number of legs — so the last frame flows into the first.
 */

/**
 * Loop length in seconds.
 *
 * Fixed rather than derived from brand motion, and deliberately so: the card
 * repeats forever, so its length is not something the viewer perceives. What
 * they perceive is whether the seam shows. Eight seconds divides cleanly into
 * the cycles below and keeps the file small.
 */
const LOOP = 8

export const sceneCard: CompositionTemplate = {
  id: 'scene-card',
  name: 'Scene card',
  summary: 'A full-frame holding card with ambient motion that loops seamlessly.',
  usage: 'Starting Soon, Be Right Back, Stream Ending — set the words per render.',
  width: 1920,
  height: 1080,
  format: 'mp4',
  loops: true,
  usesLogo: true,
  headline: {
    label: 'Headline',
    hint: 'Starting Soon, Be Right Back, Stream Ending — whatever the scene is.',
    max: 32,
  },
  subhead: {
    label: 'Supporting line',
    hint: 'Optional. A second line under the headline.',
    max: 80,
  },

  duration() {
    return LOOP
  },

  defaults() {
    return { headline: 'Starting Soon', subhead: 'Stay tuned' }
  },

  build(context) {
    const { identity, input, logoSrc, width, height, durationSeconds } = context
    const { motion, colors } = identity

    const headline = input.headline.trim() || 'Starting Soon'
    const subhead = input.subhead.trim()
    const headlineSize = fitFontSize(headline, { max: 152, min: 64, maxWidth: 1320 })

    // Cycle lengths that divide the loop into an even number of legs, so every
    // yoyo tween is back at its starting value when the clip restarts.
    const pulseLeg = seconds(durationSeconds / 4)
    const dotLeg = seconds(durationSeconds / 8)

    const timeline: string[] = [
      `tl.to("#halo", { rotation: 360, duration: ${durationSeconds}, ease: "none" }, 0)`,
      `  .to("#pulse", { scale: 1.08, opacity: 0.7, duration: ${pulseLeg}, repeat: 3, yoyo: true, ease: "sine.inOut" }, 0);`,
      // Three dots reading left to right, then settling back. Six legs each, so
      // the last one finishes well inside the loop.
      `["#dot-1", "#dot-2", "#dot-3"].forEach(function (dot, index) {`,
      `  tl.to(dot, { opacity: 1, y: -${Math.round(motion.travel * 0.22)}, duration: ${dotLeg}, repeat: 5, yoyo: true, ease: "sine.inOut" }, index * ${seconds(motion.stagger * 2)});`,
      `});`,
    ]

    if (motion.accents.sweep) {
      timeline.push(
        `tl.to("#sweep", { rotation: -360, duration: ${durationSeconds}, ease: "none" }, 0);`,
      )
    }

    return composeDocument({
      compositionId: 'main',
      title: `${escapeHtml(headline)} — scene card`,
      width,
      height,
      durationSeconds,
      transparent: false,
      identity,
      styles: `
        #halo, #sweep, #pulse {
          position: absolute;
          left: 50%;
          top: 50%;
          transform-origin: center;
        }

        #halo {
          width: 1320px;
          height: 1320px;
          margin: -660px 0 0 -660px;
          border-radius: 50%;
          border: var(--hf-hairline) solid ${withAlpha(colors.primary, 0.35)};
          border-top-color: ${withAlpha(colors.accent, 0.85)};
        }

        #sweep {
          width: 1600px;
          height: 1600px;
          margin: -800px 0 0 -800px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            ${withAlpha(colors.secondary, 0.16)} 40deg,
            transparent 90deg
          );
        }

        #pulse {
          width: 980px;
          height: 980px;
          margin: -490px 0 0 -490px;
          border-radius: 50%;
          opacity: 0.45;
          background: radial-gradient(
            circle,
            ${withAlpha(colors.primary, 0.42)} 0%,
            transparent 66%
          );
        }

        .stack {
          position: relative;
          display: grid;
          justify-items: center;
          gap: 30px;
          width: 1400px;
          text-align: center;
        }

        .brand-logo {
          width: 148px;
          height: 148px;
          object-fit: contain;
        }

        #headline {
          font-size: ${headlineSize}px;
          color: var(--hf-text);
        }

        #subhead {
          margin: 0;
          font-size: 36px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--hf-muted);
        }

        #dots {
          display: flex;
          gap: 22px;
          margin-top: 8px;
        }

        #dots span {
          display: block;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--hf-accent-readable);
          opacity: 0.32;
        }
      `,
      body: `
        ${decorativeLayers(identity, { glow: false })}
        <section id="card" class="clip" data-start="0" data-duration="${durationSeconds}">
          <div id="pulse" aria-hidden="true"></div>
          ${motion.accents.sweep ? '<div id="sweep" aria-hidden="true" data-layout-allow-overflow></div>' : ''}
          <!-- Both rings are wider than the frame on purpose: they bleed off
                 the edges rather than sitting inside it. -->
            <div id="halo" aria-hidden="true" data-layout-allow-overflow></div>
          <div class="stack">
            ${logoSrc ? `<img class="brand-logo" src="${escapeHtml(logoSrc)}" alt="" />` : ''}
            <h1 id="headline" class="heading">${escapeHtml(headline)}</h1>
            ${subhead ? `<p id="subhead">${escapeHtml(subhead)}</p>` : ''}
            <div id="dots" aria-hidden="true">
              <span id="dot-1"></span><span id="dot-2"></span><span id="dot-3"></span>
            </div>
          </div>
        </section>
      `,
      timeline: timeline.join('\n'),
    })
  },
}
