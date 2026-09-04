'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { moveWidgetAction } from '@/app/(app)/stream/overlays/[id]/editor/actions'
import { WidgetRenderer } from '@/components/widgets/widget-renderer'
import { EMPTY_WIDGET_DATA, type WidgetData } from '@/components/widgets/widget-data'
import type { BrandDna } from '@/lib/schemas/brand'
import type { OverlayWidgetModel } from '@/lib/schemas/overlay'
import { cn } from '@/lib/utils'

/**
 * The editor canvas.
 *
 * Widgets are positioned in canvas pixels and the whole canvas is scaled to
 * fit, so what you arrange here lands identically in OBS at full size.
 *
 * Drag and resize are tracked locally at pointer speed and written to the
 * database once, on release. Saving on every pointer move would mean hundreds
 * of writes for one drag.
 */

type Drag =
  | { kind: 'move'; id: string; startX: number; startY: number; originX: number; originY: number }
  | {
      kind: 'resize'
      id: string
      handle: 'se' | 'sw' | 'ne' | 'nw'
      startX: number
      startY: number
      origin: { x: number; y: number; width: number; height: number }
    }

/** Snap positions to this many canvas pixels while dragging. */
const GRID = 8

function snap(value: number) {
  return Math.round(value / GRID) * GRID
}

export function EditorCanvas({
  overlayId,
  widgets,
  canvasWidth,
  canvasHeight,
  dna,
  logoUrl,
  selectedId,
  onSelect,
  previewData = EMPTY_WIDGET_DATA,
}: {
  overlayId: string
  widgets: OverlayWidgetModel[]
  canvasWidth: number
  canvasHeight: number
  dna: BrandDna
  logoUrl: string | null
  selectedId: string | null
  onSelect: (id: string | null) => void
  previewData?: WidgetData
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const [drag, setDrag] = useState<Drag | null>(null)
  /** Live geometry during a drag, so the canvas follows the pointer. */
  const [ghost, setGhost] = useState<Record<string, Partial<OverlayWidgetModel>>>({})

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / canvasWidth)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [canvasWidth])

  const geometryOf = useCallback(
    (widget: OverlayWidgetModel) => ({ ...widget, ...ghost[widget.id] }),
    [ghost],
  )

  useEffect(() => {
    if (!drag || scale === 0) return

    function onMove(event: PointerEvent) {
      if (!drag) return
      // Pointer movement is in screen pixels; the canvas is in its own.
      const dx = (event.clientX - drag.startX) / scale
      const dy = (event.clientY - drag.startY) / scale

      if (drag.kind === 'move') {
        setGhost((current) => ({
          ...current,
          [drag.id]: { x: snap(drag.originX + dx), y: snap(drag.originY + dy) },
        }))
        return
      }

      const { origin, handle } = drag
      const right = handle === 'se' || handle === 'ne'
      const bottom = handle === 'se' || handle === 'sw'

      const width = Math.max(40, snap(right ? origin.width + dx : origin.width - dx))
      const height = Math.max(40, snap(bottom ? origin.height + dy : origin.height - dy))

      setGhost((current) => ({
        ...current,
        [drag.id]: {
          width,
          height,
          // Dragging a left or top handle moves the origin as well as resizing.
          x: right ? origin.x : snap(origin.x + (origin.width - width)),
          y: bottom ? origin.y : snap(origin.y + (origin.height - height)),
        },
      }))
    }

    function onUp() {
      if (!drag) return
      const widget = widgets.find((candidate) => candidate.id === drag.id)
      const pending = ghost[drag.id]
      setDrag(null)

      if (!widget || !pending) return

      const next = { ...widget, ...pending }

      // One write per gesture, on release. The local ghost is held until the
      // server confirms, so the widget never jumps back to its old position
      // for a frame while the round trip completes.
      void moveWidgetAction({
        overlayId,
        widgetId: widget.id,
        x: next.x,
        y: next.y,
        width: next.width,
        height: next.height,
      }).finally(() => {
        setGhost((current) => {
          const remaining = { ...current }
          delete remaining[widget.id]
          return remaining
        })
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, scale, ghost, widgets, overlayId])

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg border border-line select-none"
      style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}`, background: '#0b1020' }}
      onPointerDown={(event) => {
        // A click on empty canvas deselects.
        if (event.target === event.currentTarget) onSelect(null)
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(60% 60% at 25% 30%, #1e3a5f, transparent), radial-gradient(50% 50% at 80% 70%, #3b1e5f, transparent)',
        }}
      />

      <div
        className="absolute top-0 left-0"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          visibility: scale > 0 ? 'visible' : 'hidden',
        }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onSelect(null)
        }}
      >
        {widgets.map((widget) => {
          const geometry = geometryOf(widget)
          const selected = widget.id === selectedId

          return (
            <div
              key={widget.id}
              role="button"
              tabIndex={0}
              aria-label={`${widget.type} widget`}
              aria-pressed={selected}
              onPointerDown={(event) => {
                event.stopPropagation()
                onSelect(widget.id)
                if (widget.locked) return

                setDrag({
                  kind: 'move',
                  id: widget.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: geometry.x,
                  originY: geometry.y,
                })
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(widget.id)
                }
              }}
              className={cn(
                'absolute outline-offset-2',
                widget.locked ? 'cursor-not-allowed' : 'cursor-move',
              )}
              style={{
                left: geometry.x,
                top: geometry.y,
                width: geometry.width,
                height: geometry.height,
                zIndex: widget.zIndex,
                // Scale the selection outline so it stays 2px on screen.
                outline: selected
                  ? `${Math.max(1, 2 / (scale || 1))}px solid var(--color-accent)`
                  : 'none',
              }}
            >
              <div className="pointer-events-none h-full w-full">
                <WidgetRenderer
                  widget={{ ...widget, ...geometry }}
                  dna={dna}
                  data={previewData}
                  logoUrl={logoUrl}
                  editing
                />
              </div>

              {selected && !widget.locked
                ? (['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
                    <span
                      key={handle}
                      role="presentation"
                      onPointerDown={(event) => {
                        event.stopPropagation()
                        setDrag({
                          kind: 'resize',
                          id: widget.id,
                          handle,
                          startX: event.clientX,
                          startY: event.clientY,
                          origin: {
                            x: geometry.x,
                            y: geometry.y,
                            width: geometry.width,
                            height: geometry.height,
                          },
                        })
                      }}
                      className="absolute bg-[var(--color-accent)]"
                      style={{
                        // Sized in canvas units so the handle is a consistent
                        // physical size no matter the zoom.
                        width: 12 / (scale || 1),
                        height: 12 / (scale || 1),
                        borderRadius: 3 / (scale || 1),
                        top: handle.startsWith('n') ? -6 / (scale || 1) : undefined,
                        bottom: handle.startsWith('s') ? -6 / (scale || 1) : undefined,
                        left: handle.endsWith('w') ? -6 / (scale || 1) : undefined,
                        right: handle.endsWith('e') ? -6 / (scale || 1) : undefined,
                        cursor: `${handle}-resize`,
                      }}
                    />
                  ))
                : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
