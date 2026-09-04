'use client'

import { useState } from 'react'

import {
  addWidgetAction,
  deleteWidgetAction,
  duplicateWidgetAction,
  reorderWidgetAction,
  toggleLockAction,
} from '@/app/(app)/stream/overlays/[id]/editor/actions'
import { EditorCanvas } from '@/app/(app)/stream/overlays/[id]/editor/editor-canvas'
import { PropertiesPanel } from '@/app/(app)/stream/overlays/[id]/editor/properties-panel'
import { Button } from '@/components/ui/button'
import { Panel, PanelHeader } from '@/components/ui/panel'
import type { WidgetData } from '@/components/widgets/widget-data'
import type { BrandDna } from '@/lib/schemas/brand'
import {
  IMPLEMENTED_WIDGET_TYPES,
  WIDGET_LABELS,
  type OverlayWidgetModel,
} from '@/lib/schemas/overlay'
import { cn } from '@/lib/utils'

/**
 * The overlay editor.
 *
 * Three columns: what you can add, the canvas, and the selected widget's
 * settings. Deliberately not a Figma clone — placing, sizing, layering and
 * configuring is the whole job, and every extra affordance is one more thing
 * to get wrong minutes before going live.
 */
export function EditorShell({
  overlayId,
  widgets,
  canvasWidth,
  canvasHeight,
  dna,
  logoUrl,
  assets,
  previewData,
}: {
  overlayId: string
  widgets: OverlayWidgetModel[]
  canvasWidth: number
  canvasHeight: number
  dna: BrandDna
  logoUrl: string | null
  assets: { id: string; type: string }[]
  previewData: WidgetData
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = widgets.find((widget) => widget.id === selectedId) ?? null

  return (
    <div className="grid gap-5 xl:grid-cols-[13rem_1fr_18rem] xl:items-start">
      <Panel className="xl:sticky xl:top-8">
        <PanelHeader title="Add" />
        <ul className="space-y-1 px-3 py-3">
          {IMPLEMENTED_WIDGET_TYPES.map((type) => (
            <li key={type}>
              <form action={addWidgetAction}>
                <input type="hidden" name="overlayId" value={overlayId} />
                <input type="hidden" name="type" value={type} />
                <button
                  type="submit"
                  // Named for what it does, not just what it is: the layers
                  // list below has buttons with the same visible text, and
                  // "Clock" alone tells a screen reader nothing about which.
                  aria-label={`Add ${WIDGET_LABELS[type].name}`}
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-raised"
                >
                  <span className="block text-sm text-ink">{WIDGET_LABELS[type].name}</span>
                  <span className="block text-xs text-ink-subtle">
                    {WIDGET_LABELS[type].description}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="space-y-4">
        <EditorCanvas
          overlayId={overlayId}
          widgets={widgets}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          dna={dna}
          logoUrl={logoUrl}
          selectedId={selectedId}
          onSelect={setSelectedId}
          previewData={previewData}
        />

        <Panel>
          <PanelHeader
            title="Layers"
            description="Later items sit in front"
          />
          {widgets.length === 0 ? (
            <p className="px-5 py-5 text-sm text-ink-subtle">
              Nothing placed yet. Add a widget from the left — an alert box is the usual
              starting point.
            </p>
          ) : (
            <ul>
              {[...widgets].reverse().map((widget) => (
                <li
                  key={widget.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-2.5 last:border-b-0',
                    widget.id === selectedId && 'bg-accent-soft/30',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(widget.id)}
                    aria-label={`Select ${WIDGET_LABELS[widget.type].name}`}
                    className="min-w-0 flex-1 text-left text-sm text-ink hover:underline"
                  >
                    {WIDGET_LABELS[widget.type].name}
                    {widget.locked ? (
                      <span className="ml-2 text-xs text-ink-subtle">locked</span>
                    ) : null}
                  </button>

                  <div className="flex items-center gap-1">
                    {(['backward', 'forward'] as const).map((direction) => (
                      <form key={direction} action={reorderWidgetAction}>
                        <input type="hidden" name="overlayId" value={overlayId} />
                        <input type="hidden" name="widgetId" value={widget.id} />
                        <input type="hidden" name="direction" value={direction} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          aria-label={direction === 'forward' ? 'Bring forward' : 'Send backward'}
                        >
                          {direction === 'forward' ? '↑' : '↓'}
                        </Button>
                      </form>
                    ))}

                    <form action={toggleLockAction}>
                      <input type="hidden" name="overlayId" value={overlayId} />
                      <input type="hidden" name="widgetId" value={widget.id} />
                      <input type="hidden" name="locked" value={String(widget.locked)} />
                      <Button type="submit" variant="ghost" size="sm">
                        {widget.locked ? 'Unlock' : 'Lock'}
                      </Button>
                    </form>

                    <form action={duplicateWidgetAction}>
                      <input type="hidden" name="overlayId" value={overlayId} />
                      <input type="hidden" name="widgetId" value={widget.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Duplicate
                      </Button>
                    </form>

                    <form action={deleteWidgetAction}>
                      <input type="hidden" name="overlayId" value={overlayId} />
                      <input type="hidden" name="widgetId" value={widget.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Delete
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="xl:sticky xl:top-8">
        <PanelHeader
          title={selected ? WIDGET_LABELS[selected.type].name : 'Settings'}
          description={selected ? undefined : 'Select a widget to edit it'}
        />
        {selected ? (
          <PropertiesPanel overlayId={overlayId} widget={selected} assets={assets} />
        ) : (
          <p className="px-5 py-5 text-sm text-ink-subtle">
            Click a widget on the canvas, or pick one from Layers.
          </p>
        )}
      </Panel>
    </div>
  )
}
