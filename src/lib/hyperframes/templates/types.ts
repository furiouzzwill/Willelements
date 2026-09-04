import type { VisualIdentity } from '@/lib/hyperframes/identity'

/**
 * What a composition template is.
 *
 * A template is a pure function from a brand identity to a standalone
 * HyperFrames HTML file. It holds no state, touches no database and reads no
 * filesystem — the render service handles all of that — so a template can be
 * rendered to a string in a test and asserted against.
 */

/**
 * Output container.
 *
 * `webm` is not a preference, it is a requirement: MP4/H.264 has no alpha
 * channel, so a composition designed to sit over gameplay has to be encoded in
 * a format that carries transparency. The template declares both together.
 */
export type CompositionFormat = 'mp4' | 'webm'

export type CompositionInput = {
  headline: string
  subhead: string
}

export type CompositionContext = {
  identity: VisualIdentity
  brandName: string
  input: CompositionInput
  /**
   * Path to the brand logo *relative to the project directory*, or null.
   *
   * Always relative: the composition is opened as a file by the renderer, and
   * an absolute path from this machine would make the project unrenderable
   * anywhere else — including inside the CLI's Docker mode.
   */
  logoSrc: string | null
  width: number
  height: number
  durationSeconds: number
}

/** A free-text field the template exposes for editing before a render. */
export type CompositionField = {
  label: string
  hint: string
  max: number
}

export type CompositionTemplate = {
  id: string
  name: string
  summary: string
  /** Where this belongs in a stream, in the streamer's terms. */
  usage: string
  width: number
  height: number
  format: CompositionFormat
  /** True when the composition is built to loop cleanly as an OBS media source. */
  loops: boolean
  /** Whether the brand's logo appears, so the UI can say when one is missing. */
  usesLogo: boolean
  headline: CompositionField | null
  subhead: CompositionField | null
  /**
   * How long the finished video is, in seconds.
   *
   * Derived from the identity rather than fixed: a brand set to slow, cinematic
   * motion genuinely needs a longer sting than one set to fast and explosive,
   * and cutting the second one to the first one's length would clip it.
   */
  duration(identity: VisualIdentity): number
  defaults(brandName: string): CompositionInput
  build(context: CompositionContext): string
}

/** Rounds to hundredths — enough precision for frame timing, no float noise. */
export function seconds(value: number): number {
  return Math.round(value * 100) / 100
}
