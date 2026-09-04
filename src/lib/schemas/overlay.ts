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

/** Widget types the editor can place and the runtime can render. */
export const IMPLEMENTED_WIDGET_TYPES: readonly WidgetType[] = [
  'alert-box',
  'text',
  'image',
  'latest-follower',
  'latest-subscriber',
  'recent-events',
  'follower-goal',
  'clock',
]

/** What each type is called in the editor, and what it does. */
export const WIDGET_LABELS: Record<WidgetType, { name: string; description: string }> = {
  'alert-box': { name: 'Alert box', description: 'Where alerts appear on screen' },
  text: { name: 'Text', description: 'A fixed line of text' },
  image: { name: 'Image', description: 'Your logo or any uploaded image' },
  'latest-follower': { name: 'Latest follower', description: 'Updates as follows arrive' },
  'latest-subscriber': { name: 'Latest subscriber', description: 'Updates as subs arrive' },
  'recent-events': { name: 'Recent events', description: 'A rolling list of activity' },
  'follower-goal': { name: 'Follower goal', description: 'Progress towards a target' },
  clock: { name: 'Clock', description: 'The current time' },
  'webcam-frame': { name: 'Webcam frame', description: 'A border around your camera' },
  chat: { name: 'Chat', description: 'Live chat messages' },
}

/** A sensible starting size for each type, in canvas pixels. */
export const WIDGET_DEFAULT_SIZE: Record<WidgetType, { width: number; height: number }> = {
  'alert-box': { width: 800, height: 400 },
  text: { width: 420, height: 90 },
  image: { width: 240, height: 240 },
  'latest-follower': { width: 420, height: 100 },
  'latest-subscriber': { width: 420, height: 100 },
  'recent-events': { width: 420, height: 260 },
  'follower-goal': { width: 480, height: 120 },
  clock: { width: 260, height: 90 },
  'webcam-frame': { width: 480, height: 270 },
  chat: { width: 380, height: 500 },
}

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
  z.object({
    type: z.literal('latest-follower'),
    label: z.string().max(40).default('Latest follower'),
    fontSize: z.number().int().min(8).max(200).default(32),
  }),
  z.object({
    type: z.literal('latest-subscriber'),
    label: z.string().max(40).default('Latest subscriber'),
    fontSize: z.number().int().min(8).max(200).default(32),
  }),
  z.object({
    type: z.literal('recent-events'),
    label: z.string().max(40).default('Recent'),
    limit: z.number().int().min(1).max(20).default(5),
    fontSize: z.number().int().min(8).max(120).default(22),
  }),
  z.object({
    type: z.literal('follower-goal'),
    label: z.string().max(40).default('Follower goal'),
    target: z.number().int().positive().default(100),
    fontSize: z.number().int().min(8).max(120).default(24),
  }),
  z.object({ type: z.literal('chat') }),
  z.object({
    type: z.literal('clock'),
    format: z.enum(['12h', '24h']).default('24h'),
    fontSize: z.number().int().min(8).max(200).default(48),
  }),
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

/** A widget as the editor and runtime handle it. */
export const overlayWidget = z.object({
  id: z.string(),
  type: z.enum(WIDGET_TYPES),
  config: widgetConfig,
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  zIndex: z.number().int(),
  locked: z.boolean(),
})

export type OverlayWidgetModel = z.infer<typeof overlayWidget>

/** A fully-defaulted config for a newly placed widget. */
export function defaultConfigFor(type: WidgetType): WidgetConfig {
  return widgetConfig.parse({ type })
}
