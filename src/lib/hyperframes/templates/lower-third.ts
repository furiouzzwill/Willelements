import { withAlpha } from '@/lib/hyperframes/color'
import { escapeHtml, fitFontSize } from '@/lib/hyperframes/html'
import type { VisualIdentity } from '@/lib/hyperframes/identity'
import { composeDocument } from '@/lib/hyperframes/templates/shell'
import { seconds, type CompositionTemplate } from '@/lib/hyperframes/templates/types'

/**
 * The lower third — a name bar that slides in over gameplay and leaves again.
 *
 * **This one renders as WebM, not MP4.** It is designed to sit on top of live
 * footage, which means the frame around the bar has to be genuinely
 * transparent, and H.264 has no alpha channel to carry that. OBS plays
 * alpha WebM in a media source, so the format follows the intent rather than
 * the default.
 *
 * No decorative layers either: a vignette or a grain wash is a full-frame
 * overlay, and a full-frame overlay on a transparent composition is a tint over
 * the whole stream.
 */

const HOLD = 2.6

function timings(identity: VisualIdentity) {
  const { duration } = identity.motion
  const entrance = duration.base
  const exit = duration.quick
  return { entrance, exit, total: seconds(entrance + HOLD + exit + 0.2) }
}

export const lowerThird: CompositionTemplate = {
  id: 'lower-third',
  name: 'Lower third',
  summary: 'A name bar that slides in over gameplay and leaves cleanly.',
  usage: 'Introduce yourself, a guest, or the segment — plays over live footage.',
  width: 1920,
  height: 1080,
  format: 'webm',
  loops: false,
  usesLogo: true,
  headline: {
    label: 'Name',
    hint: 'Defaults to your brand name.',
    max: 40,
  },
  subhead: {
    label: 'Role or segment',
    hint: 'The smaller line underneath.',
    max: 60,
  },

  duration(identity) {
    return timings(identity).total
  },

  defaults(brandName) {
    return { headline: brandName, subhead: 'Live on Twitch' }
  },

  build(context) {
    const { identity, input, logoSrc, width, height, durationSeconds } = context
    const { motion, colors } = identity
    const { entrance, exit } = timings(identity)

    const name = input.headline.trim() || context.brandName
    const role = input.subhead.trim()
    const nameSize = fitFontSize(name, { max: 68, min: 34, maxWidth: 760 })

    // Resolve the exit before the clip ends. The visibility window is half-open,
    // so an animation landing exactly on the duration is never rendered.
    const exitAt = seconds(Math.max(entrance, durationSeconds - exit - 0.1))

    const timeline: string[] = [
      `tl.from("#lower", { x: -${motion.travel + 120}, opacity: 0, duration: ${entrance}, ease: "${motion.ease.entrance}" }, 0)`,
      `  .from("#accent", { scaleY: 0, duration: ${motion.duration.quick}, ease: "${motion.ease.entrance}" }, ${seconds(motion.stagger * 2)})`,
      `  .from("#name", { y: ${Math.round(motion.travel * 0.35)}, opacity: 0, duration: ${motion.duration.quick}, ease: "${motion.ease.entrance}" }, ${seconds(motion.stagger * 3)});`,
    ]

    if (role) {
      timeline.push(
        `tl.from("#role", { y: ${Math.round(motion.travel * 0.25)}, opacity: 0, duration: ${motion.duration.quick}, ease: "${motion.ease.entrance}" }, ${seconds(motion.stagger * 5)});`,
      )
    }

    timeline.push(
      `tl.to("#lower", { x: -${motion.travel + 120}, opacity: 0, duration: ${exit}, ease: "${motion.ease.exit}" }, ${exitAt});`,
    )

    return composeDocument({
      compositionId: 'main',
      title: `${escapeHtml(name)} — lower third`,
      width,
      height,
      durationSeconds,
      transparent: true,
      identity,
      styles: `
        /* The shared .clip rule centres its contents, which is wrong for a bar
           anchored to one corner. Block layout hands positioning to #lower. */
        #stage {
          display: block;
        }

        #lower {
          position: absolute;
          left: 132px;
          bottom: 132px;
          display: flex;
          align-items: stretch;
          gap: 26px;
          padding: 26px 44px 26px 30px;
          max-width: 1100px;
          border-radius: var(--hf-radius);
          background: linear-gradient(
            100deg,
            ${withAlpha(colors.background, 0.94)} 0%,
            ${withAlpha(colors.surface, 0.86)} 100%
          );
          box-shadow: 0 24px 60px ${withAlpha(colors.background, 0.55)};
        }

        #accent {
          width: 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, var(--hf-primary), var(--hf-secondary));
          transform-origin: center bottom;
        }

        .bar-logo {
          width: 84px;
          height: 84px;
          object-fit: contain;
          align-self: center;
        }

        .bar-text {
          display: grid;
          gap: 8px;
          align-content: center;
        }

        #name {
          font-size: ${nameSize}px;
          color: var(--hf-text);
        }

        #role {
          margin: 0;
          font-size: 26px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--hf-accent-readable);
        }
      `,
      body: `
        <section
          id="stage"
          class="clip"
          data-start="0"
          data-duration="${durationSeconds}"
          data-layout-allow-caption-zone
        >
          <div id="lower">
            <div id="accent" aria-hidden="true"></div>
            ${logoSrc ? `<img class="bar-logo" src="${escapeHtml(logoSrc)}" alt="" />` : ''}
            <div class="bar-text">
              <h1 id="name" class="heading">${escapeHtml(name)}</h1>
              ${role ? `<p id="role">${escapeHtml(role)}</p>` : ''}
            </div>
          </div>
        </section>
      `,
      timeline: timeline.join('\n'),
    })
  },
}
