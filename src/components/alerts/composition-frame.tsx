'use client'

import { useEffect, useMemo, useRef } from 'react'

import type { BrandDna } from '@/lib/schemas/brand'
import type { Composition } from '@/lib/schemas/composition'
import {
  buildFrameDocument,
  FRAME_MESSAGE_SOURCE,
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
  /**
   * Called once per mount with what the frame reported about itself: that it
   * started, that it threw, or that it painted something across the whole
   * frame. This is the only channel out of a null-origin frame — the parent
   * cannot read its title or its DOM.
   */
  onStatus,
}: {
  composition: Composition
  dna: BrandDna
  values: CompositionValues
  logoUrl: string | null
  width: number | string
  height: number | string
  replayKey?: string | number
  onStatus?: (status: { ok: boolean; error?: string; backdrop?: string }) => void
}) {
  const doc = useMemo(
    () => buildFrameDocument(composition, dna, values, logoUrl),
    [composition, dna, values, logoUrl],
  )

  const frameRef = useRef<HTMLIFrameElement>(null)
  // Held in a ref so a caller passing an inline function does not tear the
  // listener down between the frame loading and its one message arriving.
  const statusRef = useRef(onStatus)
  useEffect(() => {
    statusRef.current = onStatus
  })

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Only this frame's own report counts. Anything else on the page is
      // shouting into the same window.
      if (event.source !== frameRef.current?.contentWindow) return
      const data = event.data as {
        source?: string
        error?: string
        ready?: boolean
        backdrop?: string
      } | null
      if (!data || data.source !== FRAME_MESSAGE_SOURCE) return
      if (data.error) statusRef.current?.({ ok: false, error: data.error })
      // A backdrop is reported alongside `ready`: the composition ran fine, it
      // just covers the stream. That is a different failure from throwing, and
      // the message the person sees has to say which.
      else if (data.ready) statusRef.current?.({ ok: true, backdrop: data.backdrop })
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [replayKey])

  return (
    <iframe
      ref={frameRef}
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
