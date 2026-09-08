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
</head>
<body>
${body}
<script>
  // Report a failure outward as a title change rather than staying silent.
  // The preflight reads this; live, it simply means the frame stops rather
  // than looping errors under someone's stream.
  window.onerror = function (message) {
    document.title = 'ERROR: ' + message;
    return true;
  };
</script>
</body>
</html>`
}
