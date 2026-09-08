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

export type FrameMessage = { source: string; error?: string; ready?: boolean }

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
<script>
  // Sent last, after the composition's own markup and scripts have run and
  // survived. Two frames rather than one, so a composition that throws on its
  // first animation frame is caught before this claims it started.
  //
  // A composition cannot send this itself: the screen rejects postMessage in
  // generated code, precisely so this signal stays the wrapper's.
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      window.__weReport({ ready: true });
    });
  });
</script>
</body>
</html>`
}
