/**
 * What OBS sees for an unknown or rotated token: nothing.
 *
 * A transparent empty page rather than an error screen, because a browser
 * source pointed at a stale URL should be invisible on stream, not a block of
 * text over the gameplay.
 */
export default function OverlayNotFound() {
  return null
}
