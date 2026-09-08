import type { BrandDna } from '@/lib/schemas/brand'
import { FRAME_CSP, type Composition } from '@/lib/schemas/composition'

/**
 * Building the document a composition runs inside.
 *
 * Kept out of the component file so it can be tested directly: this is the
 * function that decides what a generated composition is wrapped in, including
 * the policy that stops it reaching the network, and that is worth asserting
 * rather than assuming.
 */

/**
 * Substitutes live values into the composition.
 *
 * Done here rather than by giving the frame a data channel, because the values
 * are known at render time and a channel is a capability. Everything is
 * escaped: the composition is a document, and a viewer called
 * `<script>alert(1)</script>` should be a funny name rather than an event.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Tags the messages the frame sends out, so the parent can tell them from the
 * noise every page receives. It is not a secret and is not treated as one —
 * the listener also checks the message came from the frame it owns.
 */
export const FRAME_MESSAGE_SOURCE = 'willelements:composition'

export type FrameMessage = {
  source: string
  error?: string
  ready?: boolean
  /**
   * Set when the composition paints something opaque across the whole frame.
   *
   * A composition is 1920×1080 and sits over live gameplay, so a full-bleed
   * background is not a style choice — it is a screen-sized rectangle covering
   * the stream every time the alert fires. The value describes what was found,
   * so the message can name it rather than say "something".
   */
  backdrop?: string
}

export type CompositionValues = {
  username: string
  amount: string
  message: string
  label: string
}

export function buildFrameDocument(
  composition: Composition,
  dna: BrandDna,
  values: CompositionValues,
  logoUrl: string | null,
): string {
  const { colors, typography } = dna

  let body = composition.html
  for (const [token, value] of Object.entries(values)) {
    body = body.replaceAll(`{{${token}}}`, escapeHtml(value))
  }
  // A logo is a URL the app owns, or nothing. Never a remote address.
  body = body.replaceAll('{{logo}}', logoUrl ? escapeHtml(logoUrl) : '')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}">
<style>
  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
  }
  :root {
    --primary: ${colors.primary};
    --secondary: ${colors.secondary};
    --accent: ${colors.accent};
    --background: ${colors.background};
    --text: ${colors.text};
    --heading-font: ${JSON.stringify(typography.heading)}, system-ui, sans-serif;
    --body-font: ${JSON.stringify(typography.body)}, system-ui, sans-serif;
  }
  body { font-family: var(--body-font); color: var(--text); }
</style>
<script>
  // Installed before the composition, because an inline script that throws
  // while it is parsed does so before anything appended after it exists. The
  // first version of this sat at the end of the body and never saw a failure
  // that happened on load, which is the failure that matters.
  //
  // postMessage is the only channel out of a null-origin frame — the parent
  // cannot read this document's title or its DOM, which is the point of the
  // sandbox.
  (function () {
    var sent = false;
    window.__weReport = function (payload) {
      if (sent) return;
      sent = true;
      try {
        payload.source = ${JSON.stringify(FRAME_MESSAGE_SOURCE)};
        parent.postMessage(payload, '*');
      } catch (e) {}
    };
    // Swallowing the error is deliberate: live, a broken composition should sit
    // there doing nothing rather than loop errors under someone's stream.
    window.onerror = function (message) {
      window.__weReport({ error: String(message) });
      return true;
    };
    window.addEventListener('unhandledrejection', function (event) {
      window.__weReport({ error: String(event.reason) });
    });
  })();
</script>
</head>
<body>
${body}
<style>
  /* Last word on the frame's own ground, after the composition's styles.
     A composition that sets 'body { background: #fff }' is not expressing a
     preference — it is painting over the gameplay this sits on top of. Element
     backgrounds are untouched: the alert's own panel still draws normally. */
  html, body {
    background: transparent !important;
    background-image: none !important;
  }
</style>
<script>
  // Sent last, after the composition's own markup and scripts have run and
  // survived. Two frames rather than one, so a composition that throws on its
  // first animation frame is caught before this claims it started.
  //
  // A composition cannot send this itself: the screen rejects postMessage in
  // generated code, precisely so this signal stays the wrapper's.
  // What the forced-transparent rule above cannot reach: an element inside the
  // composition stretched across the whole frame. 'html, body' can be overruled
  // from out here; a div with 'position: fixed; inset: 0' has to be found.
  //
  // Measured rather than pattern-matched, because this is the one place with a
  // real layout to measure — the frame has already run. A regex over the source
  // would have to guess at what the CSS resolves to.
  function findBackdrop() {
    var frameWidth = document.documentElement.clientWidth;
    var frameHeight = document.documentElement.clientHeight;
    if (!frameWidth || !frameHeight) return null;

    var nodes = document.body.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var element = nodes[i];
      var box = element.getBoundingClientRect();
      // Both dimensions, not area: a 1920×80 banner is a legitimate alert and
      // covers a tenth of the frame either way.
      if (box.width < frameWidth * 0.9 || box.height < frameHeight * 0.9) continue;

      var styles = getComputedStyle(element);
      if (styles.visibility === 'hidden' || styles.display === 'none') continue;
      if (parseFloat(styles.opacity) < 0.15) continue;

      var name = element.tagName.toLowerCase() + (element.id ? '#' + element.id : '');

      if (styles.backgroundImage && styles.backgroundImage !== 'none') {
        var image = styles.backgroundImage;
        // Named in a sentence a person reads, so it is trimmed rather than
        // dumped -- an unbalanced half of a gradient helps nobody.
        return name + ' (' + (image.length > 60 ? image.slice(0, 60) + '...' : image) + ')';
      }

      var parts = /rgba?\(([^)]+)\)/.exec(styles.backgroundColor || '');
      if (parts) {
        var channels = parts[1].split(',');
        var alpha = channels.length > 3 ? parseFloat(channels[3]) : 1;
        // A deliberate light scrim is fine; anything you would notice is not.
        if (alpha > 0.15) return name + ' (' + styles.backgroundColor + ')';
      }
    }

    return null;
  }

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var backdrop = null;
      try {
        backdrop = findBackdrop();
      } catch (e) {
        // An audit that throws must not fail the composition it was auditing.
      }
      window.__weReport(backdrop ? { ready: true, backdrop: backdrop } : { ready: true });
    });
  });
</script>
</body>
</html>`
}
