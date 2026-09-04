"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { updateWidgetConfigAction } from "@/app/(app)/stream/overlays/[id]/editor/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { OverlayWidgetModel, WidgetConfig } from "@/lib/schemas/overlay";

/**
 * Settings for the selected widget.
 *
 * The whole config is submitted as JSON and validated server-side against the
 * widget schema. That keeps the panel free to render whatever fields a type
 * needs without a matching server-side form parser per type — and the closed
 * schema still rejects anything unexpected.
 */

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Apply"}
    </Button>
  );
}

/**
 * A labelled control.
 *
 * The generated id is handed to the child rather than the child being cloned,
 * so the binding is explicit and type-checked. Without it a screen reader
 * announces the control with no name.
 */
function Row({
  label,
  children,
}: {
  label: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
    </div>
  );
}

export function PropertiesPanel({
  overlayId,
  widget,
  assets,
}: {
  overlayId: string;
  widget: OverlayWidgetModel;
  assets: { id: string; type: string }[];
}) {
  const [state, action] = useActionState<{ error?: string }, FormData>(
    updateWidgetConfigAction,
    {},
  );
  const [config, setConfig] = useState<WidgetConfig>(widget.config);

  // Reset when a different widget is selected.
  const [lastId, setLastId] = useState(widget.id);
  if (lastId !== widget.id) {
    setLastId(widget.id);
    setConfig(widget.config);
  }

  function patch(update: Partial<WidgetConfig>) {
    setConfig((current) => ({ ...current, ...update }) as WidgetConfig);
  }

  return (
    <form action={action} className="space-y-4 px-5 py-5">
      <input type="hidden" name="overlayId" value={overlayId} />
      <input type="hidden" name="widgetId" value={widget.id} />
      <input type="hidden" name="config" value={JSON.stringify(config)} />

      {config.type === "text" ? (
        <>
          <Row label="Text">
            {(id) => (
              <Input
                id={id}
                value={config.value}
                onChange={(event) =>
                  patch({ value: event.target.value } as never)
                }
              />
            )}
          </Row>
          <Row label="Font size">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={8}
                max={300}
                value={config.fontSize}
                onChange={(event) =>
                  patch({ fontSize: Number(event.target.value) } as never)
                }
              />
            )}
          </Row>
          <Row label="Alignment">
            {(id) => (
              <Select
                id={id}
                value={config.align}
                onChange={(event) =>
                  patch({ align: event.target.value } as never)
                }
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </Select>
            )}
          </Row>
          <Row label="Colour">
            {(id) => (
              <Input
                id={id}
                placeholder="Brand text colour"
                value={config.color ?? ""}
                onChange={(event) =>
                  patch({ color: event.target.value || null } as never)
                }
              />
            )}
          </Row>
        </>
      ) : null}

      {config.type === "image" ? (
        <>
          <Row label="Image">
            {(id) => (
              <Select
                id={id}
                value={config.assetId ?? ""}
                onChange={(event) =>
                  patch({ assetId: event.target.value || null } as never)
                }
              >
                <option value="">Brand logo</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.type} · {asset.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            )}
          </Row>
          <Row label="Fit">
            {(id) => (
              <Select
                id={id}
                value={config.fit}
                onChange={(event) =>
                  patch({ fit: event.target.value } as never)
                }
              >
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
              </Select>
            )}
          </Row>
          <Row label={`Opacity — ${Math.round(config.opacity * 100)}%`}>
            {(id) => (
              <input
                id={id}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={config.opacity}
                onChange={(event) =>
                  patch({ opacity: Number(event.target.value) } as never)
                }
                className="w-full accent-[var(--color-accent)]"
              />
            )}
          </Row>
        </>
      ) : null}

      {config.type === "latest-follower" ||
      config.type === "latest-subscriber" ||
      config.type === "recent-events" ||
      config.type === "follower-goal" ? (
        <Row label="Label">
          {(id) => (
            <Input
              id={id}
              value={config.label}
              onChange={(event) =>
                patch({ label: event.target.value } as never)
              }
            />
          )}
        </Row>
      ) : null}

      {config.type === "recent-events" ? (
        <Row label="How many to show">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              max={20}
              value={config.limit}
              onChange={(event) =>
                patch({ limit: Number(event.target.value) } as never)
              }
            />
          )}
        </Row>
      ) : null}

      {config.type === "follower-goal" ? (
        <Row label="Target">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              value={config.target}
              onChange={(event) =>
                patch({ target: Number(event.target.value) } as never)
              }
            />
          )}
        </Row>
      ) : null}

      {config.type === "clock" ? (
        <Row label="Format">
          {(id) => (
            <Select
              id={id}
              value={config.format}
              onChange={(event) =>
                patch({ format: event.target.value } as never)
              }
            >
              <option value="24h">24 hour</option>
              <option value="12h">12 hour</option>
            </Select>
          )}
        </Row>
      ) : null}

      {"fontSize" in config && config.type !== "text" ? (
        <Row label="Font size">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={8}
              max={200}
              value={config.fontSize}
              onChange={(event) =>
                patch({ fontSize: Number(event.target.value) } as never)
              }
            />
          )}
        </Row>
      ) : null}

      {config.type === "alert-box" ? (
        <p className="text-sm text-ink-subtle">
          This box marks where alerts appear. It is invisible on stream — move
          and resize it to position your alerts.
        </p>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live"
        >
          {state.error}
        </p>
      ) : null}

      {config.type !== "alert-box" ? <SaveButton /> : null}
    </form>
  );
}
