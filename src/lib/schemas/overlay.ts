import { z } from 'zod'

/**
 * Overlay widgets.
 *
 * The registry is closed on purpose: a widget type that is not listed here is
 * rejected rather than passed through. That matters because AI will eventually
 * be editing these structures, and "validate against a known registry" is the
 * boundary that keeps generated content from becoming generated behaviour.
 */

export const WIDGET_TYPES = [
  'alert-box',
  'image',
  'text',
  'webcam-frame',
  'latest-follower',
  'latest-subscriber',
  'recent-events',
  'follower-goal',
  'chat',
  'clock',
] as const

export type WidgetType = (typeof WIDGET_TYPES)[number]

/** Widgets that MVP actually renders. The rest are declared but not built. */
export const IMPLEMENTED_WIDGET_TYPES: readonly WidgetType[] = [
  'alert-box',
  'image',
  'text',
]

const alignment = z.enum(['left', 'center', 'right'])

export const widgetConfig = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('alert-box'),
    /** Which event types this box reacts to. Empty means all enabled alerts. */
    eventTypes: z.array(z.string()).default([]),
  }),
  z.object({
    type: z.literal('image'),
    assetId: z.string().nullish(),
    fit: z.enum(['contain', 'cover']).default('contain'),
    opacity: z.number().min(0).max(1).default(1),
  }),
  z.object({
    type: z.literal('text'),
    value: z.string().max(300).default('Text'),
    fontSize: z.number().int().min(8).max(300).default(48),
    align: alignment.default('left'),
    /** Null means "use the brand's text colour". */
    color: z.string().nullish(),
  }),
  z.object({ type: z.literal('webcam-frame') }),
  z.object({ type: z.literal('latest-follower') }),
  z.object({ type: z.literal('latest-subscriber') }),
  z.object({ type: z.literal('recent-events'), limit: z.number().int().min(1).max(20).default(5) }),
  z.object({ type: z.literal('follower-goal'), target: z.number().int().positive().default(100) }),
  z.object({ type: z.literal('chat') }),
  z.object({ type: z.literal('clock'), format: z.enum(['12h', '24h']).default('24h') }),
])

export type WidgetConfig = z.infer<typeof widgetConfig>

export const overlaySettings = z.object({
  /** Overlays render on transparency in OBS; this is for the editor preview. */
  previewBackground: z.enum(['transparent', 'dark', 'light']).default('transparent'),
})

export type OverlaySettings = z.infer<typeof overlaySettings>

export const CANVAS_PRESETS = [
  { label: '1920 × 1080', width: 1920, height: 1080 },
  { label: '1280 × 720', width: 1280, height: 720 },
  { label: '1080 × 1920 (vertical)', width: 1080, height: 1920 },
] as const

export const overlayInput = z.object({
  name: z.string().trim().min(1, 'Give your overlay a name.').max(80),
  canvasWidth: z.number().int().min(320).max(3840).default(1920),
  canvasHeight: z.number().int().min(240).max(3840).default(1080),
  settings: overlaySettings.prefault({}),
})

export type OverlayInput = z.infer<typeof overlayInput>
