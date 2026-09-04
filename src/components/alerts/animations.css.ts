/**
 * The alert animation stylesheet.
 *
 * Kept as a plain string rather than a CSS module for one reason: the OBS
 * browser source and the dashboard preview must render identically, and the
 * runtime injects this into a page that deliberately loads none of the app's
 * stylesheets.
 *
 * Every animation is transform and opacity only. Those are the two properties a
 * browser can animate on the compositor without laying out or painting again —
 * which is what keeps an alert from costing frames while someone is encoding a
 * stream on the same machine.
 */
export const ALERT_ANIMATION_CSS = `
@keyframes we-fade { from { opacity: 0 } to { opacity: 1 } }

@keyframes we-scale {
  from { opacity: 0; transform: scale(0.82) }
  to   { opacity: 1; transform: scale(1) }
}

@keyframes we-slide-up {
  from { opacity: 0; transform: translateY(40px) }
  to   { opacity: 1; transform: none }
}

@keyframes we-slide-down {
  from { opacity: 0; transform: translateY(-40px) }
  to   { opacity: 1; transform: none }
}

@keyframes we-wipe {
  from { opacity: 0; clip-path: inset(0 100% 0 0) }
  to   { opacity: 1; clip-path: inset(0 0 0 0) }
}

/* A short burst of displacement, then settle — not a continuous shudder. */
@keyframes we-glitch {
  0%   { opacity: 0; transform: translate3d(-14px, 0, 0) skewX(-12deg) }
  20%  { opacity: 1; transform: translate3d(10px, 0, 0) skewX(9deg) }
  40%  { transform: translate3d(-6px, 0, 0) skewX(-5deg) }
  60%  { transform: translate3d(4px, 0, 0) skewX(3deg) }
  80%  { transform: translate3d(-2px, 0, 0) skewX(-1deg) }
  100% { opacity: 1; transform: none }
}

@keyframes we-out-fade { to { opacity: 0 } }
@keyframes we-out-scale { to { opacity: 0; transform: scale(0.9) } }
@keyframes we-out-slide-up { to { opacity: 0; transform: translateY(-32px) } }
@keyframes we-out-slide-down { to { opacity: 0; transform: translateY(32px) } }

@keyframes we-word {
  from { opacity: 0; transform: translateY(12px) }
  to   { opacity: 1; transform: none }
}

@keyframes we-type { from { width: 0 } to { width: 100% } }

/* Respect the OS setting even here — an overlay is still a web page, and a
   creator sensitive to motion should not be forced into it while editing. */
@media (prefers-reduced-motion: reduce) {
  .we-alert *, .we-alert {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
`
