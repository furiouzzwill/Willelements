import { withAlpha } from '@/lib/hyperframes/color'
import { escapeHtml } from '@/lib/hyperframes/html'
import type { VisualIdentity } from '@/lib/hyperframes/identity'
import { composeDocument } from '@/lib/hyperframes/templates/shell'
import { seconds, type CompositionTemplate } from '@/lib/hyperframes/templates/types'

/**
 * A backdrop that plays behind a live alert.
 *
 * This is the one composition that exists to be layered under something else,
 * and that constraint decides everything about it.
 *
 * **It contains no text, deliberately.** The name in an alert is whoever just
 * followed, and it is known milliseconds before the alert plays. Baking a name
 * into a video would mean rendering per event — tens of seconds of CPU for
 * something that has to appear instantly — which is the exact thing
 * `docs/hyperframes.md` rules out. So the motion is pre-rendered once and the
 * words stay live DOM on top of it. Anything here that looked like a label
 * would be a promise the architecture cannot keep.
 *
 * **WebM, for the same reason as the lower third.** It sits over gameplay, so
 * the frame around the burst has to be genuinely transparent, and H.264 has no
 * alpha channel.
 *
 * **The centre is darkened, not cleared.** The first version left the middle
 * genuinely empty, on the theory that a backdrop should not compete with the
 * text. Rendered and looked at, that was wrong twice over: the composition was
 * invisible over dark gameplay, and white text on unknown footage has no
 * guaranteed contrast. So the middle carries a dark plate that the ring frames
 * — the words gain a surface to sit on, which is the same reasoning the banner
 * alert layout already uses.
 */

/** How long the burst holds open before it resolves, in seconds. */
const HOLD = 1.4

/**
 * The ring's half-extents, in canvas pixels.
 *
 * Named because two things depend on them agreeing: the CSS that draws the
 * ring, and the spark placement that has to stay outside it. When these were
 * derived separately the sparks ended up in the middle of the frame, on top of
 * the alert's own text.
 */
const RING_HALF_WIDTH = 540
const RING_HALF_HEIGHT = 210

function timings(identity: VisualIdentity) {
  const { duration } = identity.motion
  const entrance = duration.quick
  const exit = duration.base
  return { entrance, exit, total: seconds(entrance + HOLD + exit + 0.2) }
}

export const alertSting: CompositionTemplate = {
  id: 'alert-sting',
  name: 'Alert backdrop',
  summary: 'A transparent burst that plays behind a live alert, with a dark plate for the text.',
  usage: 'Set it on an alert in Stream → Alerts. The name stays live text on top.',
  width: 1920,
  height: 1080,
  format: 'webm',
  loops: false,
  usesLogo: false,
  // No editable copy: this composition carries no words at all, and offering a
  // headline field would invite baking a name into a video that is reused for
  // every viewer.
  headline: null,
  subhead: null,

  duration(identity) {
    return timings(identity).total
  },

  defaults() {
    return { headline: '', subhead: '' }
  },

  build(context) {
    const { identity, width, height, durationSeconds } = context
    const { motion, colors, surface } = identity
    const { entrance, exit } = timings(identity)

    const exitAt = seconds(Math.max(entrance, durationSeconds - exit - 0.1))

    // Sparks are placed against the ring's own geometry, not against
    // motion.travel. Travel is tens of pixels — a spark offset by that much
    // lands in the middle of the frame, which is exactly where the live alert
    // text is drawn. Anchoring to the ring keeps them outside it at every
    // brand energy, and energy then only decides how far they drift.
    const drift = Math.round(motion.travel * 0.6)

    const timeline: string[] = [
      // The ring opens outward from nothing, which reads as "something just
      // happened" without moving anything through the middle.
      `tl.from("#ring", { scale: 0.72, opacity: 0, duration: ${entrance}, ease: "${motion.ease.entrance}" }, 0)`,
      `  .from("#wash", { opacity: 0, duration: ${seconds(entrance * 1.4)}, ease: "none" }, 0)`,
      `  .from("#bar-top", { scaleX: 0, duration: ${motion.duration.quick}, ease: "${motion.ease.entrance}" }, ${seconds(motion.stagger)})`,
      `  .from("#bar-bottom", { scaleX: 0, duration: ${motion.duration.quick}, ease: "${motion.ease.entrance}" }, ${seconds(motion.stagger * 2)});`,
    ]

    // Sparks travel outward on the diagonals, so they never cross the centre
    // where the alert's own text sits.
    for (let index = 0; index < 4; index += 1) {
      const delay = seconds(motion.stagger * (index + 1))
      timeline.push(
        `tl.from("#spark-${index}", { x: 0, y: 0, opacity: 0, duration: ${motion.duration.base}, ease: "${motion.ease.entrance}" }, ${delay});`,
      )
    }

    timeline.push(
      `tl.to("#ring", { scale: 1.06, opacity: 0, duration: ${exit}, ease: "${motion.ease.exit}" }, ${exitAt});`,
      `tl.to("#wash", { opacity: 0, duration: ${exit}, ease: "none" }, ${exitAt});`,
      `tl.to(".bar", { scaleX: 0, duration: ${motion.duration.quick}, ease: "${motion.ease.exit}" }, ${exitAt});`,
      `tl.to(".spark", { opacity: 0, duration: ${motion.duration.quick}, ease: "${motion.ease.exit}" }, ${exitAt});`,
    )

    const sparks = [
      { x: -(RING_HALF_WIDTH + drift), y: -(RING_HALF_HEIGHT - 40) },
      { x: RING_HALF_WIDTH + drift, y: -(RING_HALF_HEIGHT - 40) },
      { x: -(RING_HALF_WIDTH + drift * 1.4), y: RING_HALF_HEIGHT - 20 },
      { x: RING_HALF_WIDTH + drift * 1.4, y: RING_HALF_HEIGHT - 20 },
    ]
      .map(
        (spark, index) =>
          `<span class="spark" id="spark-${index}" style="--dx:${Math.round(spark.x)}px; --dy:${Math.round(spark.y)}px;"></span>`,
      )
      .join('\n')

    return composeDocument({
      compositionId: 'main',
      title: `${escapeHtml(context.brandName)} — alert backdrop`,
      width,
      height,
      durationSeconds,
      transparent: true,
      identity,
      styles: `
        #burst {
          position: relative;
          display: grid;
          place-items: center;
          width: 100%;
          height: 100%;
        }

        /* The plate the words sit on. Dark at the centre so white text has
           contrast over whatever is being played, fading out well before the
           ring so the edge stays soft rather than looking like a box. */
        #wash {
          position: absolute;
          width: 1180px;
          height: 460px;
          border-radius: 999px;
          background: radial-gradient(
            ellipse at center,
            ${withAlpha(colors.background, 0.86)} 0%,
            ${withAlpha(colors.primary, surface.glow ? 0.5 : 0.36)} 42%,
            ${withAlpha(colors.primary, 0)} 76%
          );
        }

        #ring {
          position: absolute;
          width: ${RING_HALF_WIDTH * 2}px;
          height: ${RING_HALF_HEIGHT * 2}px;
          border-radius: 999px;
          border: ${Math.max(surface.hairline * 3, 7)}px solid ${withAlpha(colors.accent, 0.92)};
          box-shadow:
            0 0 90px ${withAlpha(colors.primary, 0.75)},
            0 0 26px ${withAlpha(colors.accent, 0.6)},
            inset 0 0 110px ${withAlpha(colors.secondary, 0.4)};
        }

        .bar {
          position: absolute;
          width: 760px;
          height: ${Math.max(surface.hairline * 3, 8)}px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            ${withAlpha(colors.primary, 0)} 0%,
            var(--hf-primary) 25%,
            var(--hf-secondary) 75%,
            ${withAlpha(colors.secondary, 0)} 100%
          );
        }

        #bar-top {
          transform: translateY(-232px);
        }

        #bar-bottom {
          transform: translateY(232px);
        }

        .spark {
          position: absolute;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--hf-accent);
          box-shadow:
            0 0 46px ${withAlpha(colors.accent, 0.95)},
            0 0 14px ${withAlpha(colors.accent, 1)};
          transform: translate(var(--dx), var(--dy));
        }
      `,
      body: `
        <div id="burst">
          <span id="wash"></span>
          <span id="ring"></span>
          <span class="bar" id="bar-top"></span>
          <span class="bar" id="bar-bottom"></span>
${sparks}
        </div>
      `,
      timeline: timeline.join('\n'),
    })
  },
}
