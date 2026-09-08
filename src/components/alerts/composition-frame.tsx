'use client'

import { useMemo } from 'react'

import type { BrandDna } from '@/lib/schemas/brand'
import type { Composition } from '@/lib/schemas/composition'
import {
  buildFrameDocument,
  type CompositionValues,
} from '@/lib/composition/frame-document'

/**
 * Runs a generated composition, isolated from everything.
 *
 * The `sandbox` attribute carries exactly one capability — `allow-scripts` —
 * and deliberately not `allow-same-origin`. Those two together would undo each
 * other: a frame with both can reach its parent and remove its own sandbox.
 * With scripts alone the frame has a null origin, so there is no cookie jar,
 * no storage, and no handle on this document.
 *
 * The CSP inside completes it by permitting no network at all. Between the two,
 * a composition can draw and animate and do nothing else.
 */

export function CompositionFrame({
  composition,
  dna,
  values,
  logoUrl,
  width,
  height,
  /** Changing this remounts the frame, which replays the composition. */
  replayKey,
}: {
  composition: Composition
  dna: BrandDna
  values: CompositionValues
  logoUrl: string | null
  width: number | string
  height: number | string
  replayKey?: string | number
}) {
  const doc = useMemo(
    () => buildFrameDocument(composition, dna, values, logoUrl),
    [composition, dna, values, logoUrl],
  )

  return (
    <iframe
      key={replayKey}
      title="Alert composition"
      // allow-scripts and nothing else. Adding allow-same-origin here would
      // let the frame reach out and remove its own sandbox.
      sandbox="allow-scripts"
      srcDoc={doc}
      scrolling="no"
      style={{
        width,
        height,
        border: 'none',
        background: 'transparent',
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  )
}
