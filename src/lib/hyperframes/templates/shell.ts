import type { VisualIdentity } from '@/lib/hyperframes/identity'
import { withAlpha } from '@/lib/hyperframes/color'

/**
 * The document scaffold every generated composition shares.
 *
 * Templates supply markup, CSS and a GSAP timeline body; this puts them inside
 * a file the HyperFrames runtime recognises. Keeping the scaffold in one place
 * is what stops a template from quietly getting the contract wrong — the root's
 * data attributes and the `window.__timelines` registration are the two things
 * that decide whether a file renders at all.
 *
 * The contract, from the HyperFrames core skill:
 *  - one root element carrying `data-composition-id`, `data-width`, `data-height`
 *  - a duration source — here always an explicit root `data-duration`
 *  - timed elements carrying `data-start` and `data-duration`
 *  - a GSAP timeline created **paused** and registered under the composition id
 *
 * The visibility window is half-open — `[start, start + duration)` — so an
 * animation must resolve slightly *before* its clip's duration or its final
 * state is never rendered.
 */

export type CompositionDocument = {
  compositionId: string
  title: string
  width: number
  height: number
  durationSeconds: number
  /**
   * Renders over gameplay rather than filling the frame.
   *
   * Transparency only survives in a format that carries alpha, so a transparent
   * composition must be rendered as WebM or MOV. The template declares the
   * format alongside this so the two cannot drift apart.
   */
  transparent: boolean
  identity: VisualIdentity
  /** Template CSS, appended after the shared base. */
  styles: string
  /** Markup placed inside the composition root. */
  body: string
  /** Statements that build the timeline. `tl` is already in scope. */
  timeline: string
}

/** GSAP is loaded from the project's own assets — never a CDN. See vendor/gsap. */
export const GSAP_SRC = 'assets/vendor/gsap.min.js'

function baseStyles(doc: CompositionDocument): string {
  const { identity, width, height, transparent } = doc
  const canvas = transparent ? 'transparent' : 'var(--hf-background)'

  return `
    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      width: ${width}px;
      height: ${height}px;
      background: ${canvas};
      color: var(--hf-text);
      font-family: var(--hf-font-body);
      font-weight: var(--hf-weight-body);
      -webkit-font-smoothing: antialiased;
    }

    #root {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${canvas};
    }

    .clip {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
    }

    .heading {
      margin: 0;
      font-family: var(--hf-font-heading);
      font-weight: var(--hf-weight-heading);
      text-transform: var(--hf-transform);
      letter-spacing: var(--hf-tracking);
      line-height: 1.04;
    }

    /* Decorative layers. Each is a full-frame overlay that never takes input
       and never affects layout, so they can be stacked in any combination. */
    .layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .layer-glow {
      background: radial-gradient(
        circle at 50% 46%,
        ${withAlpha(identity.colors.primary, 0.34)} 0%,
        ${withAlpha(identity.colors.secondary, 0.14)} 34%,
        transparent 62%
      );
    }

    .layer-vignette {
      background: radial-gradient(
        ellipse at 50% 50%,
        transparent 46%,
        ${withAlpha(identity.colors.background, 0.55)} 100%
      );
    }

    /* A fixed pattern rather than noise: the renderer must produce the same
       frames every time, so nothing here may be random. */
    .layer-grain {
      opacity: 0.05;
      background-image:
        repeating-linear-gradient(0deg, ${withAlpha(identity.colors.text, 0.6)} 0 1px, transparent 1px 3px),
        repeating-linear-gradient(90deg, ${withAlpha(identity.colors.text, 0.4)} 0 1px, transparent 1px 4px);
    }
  `
}

/** Only the decorative layers this identity actually asked for. */
export function decorativeLayers(identity: VisualIdentity, options?: { glow?: boolean }): string {
  const layers: string[] = []
  if (identity.surface.glow && options?.glow !== false) {
    layers.push('<div class="layer layer-glow" aria-hidden="true"></div>')
  }
  if (identity.surface.vignette) {
    layers.push('<div class="layer layer-vignette" aria-hidden="true"></div>')
  }
  if (identity.surface.grain) {
    layers.push('<div class="layer layer-grain" aria-hidden="true"></div>')
  }
  return layers.join('\n')
}

export function composeDocument(doc: CompositionDocument): string {
  const { compositionId, title, width, height, durationSeconds, identity } = doc

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${title}</title>
    <script src="${GSAP_SRC}"></script>
    <style>
      :root {
${reindent(identity.css, 8)}
      }
${reindent(baseStyles(doc), 6)}
${reindent(doc.styles, 6)}
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="${compositionId}"
      data-start="0"
      data-width="${width}"
      data-height="${height}"
      data-duration="${durationSeconds}"
    >
${reindent(doc.body, 6)}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
${reindent(doc.timeline, 6)}
      window.__timelines[${JSON.stringify(compositionId)}] = tl;
    </script>
  </body>
</html>
`
}

/**
 * Re-indents a block to a fixed depth.
 *
 * Templates are written as tagged template literals at whatever indentation
 * reads well in the source file. Dedenting by the block's own smallest
 * indentation preserves the structure inside it and then places the whole thing
 * where the document wants it, so generated HTML stays readable — which matters
 * when you are diffing two renders to work out why one looks wrong.
 */
function reindent(block: string, spaces: number): string {
  const lines = block.replace(/\t/g, '  ').split('\n')
  const meaningful = lines.filter((line) => line.trim())
  const common = meaningful.reduce(
    (least, line) => Math.min(least, line.length - line.trimStart().length),
    Number.POSITIVE_INFINITY,
  )
  const strip = Number.isFinite(common) ? common : 0
  const padding = ' '.repeat(spaces)

  return lines
    .map((line) => (line.trim() ? padding + line.slice(strip) : ''))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/^\n+|\n+$/g, '')
}
