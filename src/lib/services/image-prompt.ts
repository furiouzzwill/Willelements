import type { BrandDna } from '@/lib/schemas/brand'
import type { ImageSize } from '@/lib/providers/openai/pricing'

/**
 * Brand DNA becomes an image prompt, in one place.
 *
 * The same argument as `hyperframes/identity.ts`: if each subject wrote its own
 * prompt, two of them would eventually disagree about what "luxury" or
 * "minimal" means for the same brand. Every subject below reads this module's
 * vocabulary instead of interpreting the DNA itself.
 *
 * Colours go in as hex. Image models are inconsistent about honouring an exact
 * hex, but naming one is still far better than "purple" — and the brand's own
 * values are what the rest of the app renders, so the prompt should ask for
 * them rather than for an adjective.
 */

export type ImageSubject = {
  id: string
  label: string
  description: string
  size: ImageSize
  /** Logos need a clean background; a scene does not. */
  transparent: boolean
  /** The role the saved asset plays, which is not the same as its file format. */
  assetType: 'logo' | 'image' | 'background'
  /** Built from the brand, then joined into the prompt. */
  instruction: (brand: { name: string }) => string
}

export const SUBJECTS: ImageSubject[] = [
  {
    id: 'logo-concept',
    label: 'Logo concept',
    description: 'A simple, flat mark you could actually use — no text, no mockup.',
    size: '1024x1024',
    transparent: true,
    assetType: 'logo',
    instruction: () =>
      'A single flat vector-style logo mark, centred, on a plain transparent background. ' +
      'Simple geometric shapes, bold silhouette, readable at small sizes. ' +
      'No text, no lettering, no wordmark, no drop shadow, no 3D bevel, no mockup, ' +
      'no presentation board, no multiple variations in one image.',
  },
  {
    id: 'stream-background',
    label: 'Stream background',
    description: 'A full-width backdrop with a calm centre, so overlays stay readable on top.',
    size: '1536x1024',
    transparent: false,
    assetType: 'background',
    instruction: () =>
      'A wide abstract background graphic for a live stream. ' +
      'Detail and interest around the edges, with the central area kept calm and uncluttered ' +
      'so text and webcam frames placed over it stay readable. ' +
      'No text, no logos, no people, no user interface elements.',
  },
  {
    id: 'panel-art',
    label: 'Channel panel',
    description: 'A square graphic for an About / Schedule / Donate panel.',
    size: '1024x1024',
    transparent: false,
    assetType: 'image',
    instruction: () =>
      'A square decorative graphic suitable for a streaming channel information panel. ' +
      'Bold, simple, high contrast, with a clear focal point. ' +
      'No text, no lettering, no words of any kind.',
  },
  {
    id: 'offline-card',
    label: 'Offline card',
    description: 'A landscape card for when the channel is offline.',
    size: '1536x1024',
    transparent: false,
    assetType: 'image',
    instruction: () =>
      'A landscape graphic for a streaming channel offline screen. ' +
      'Atmospheric and inviting, with generous empty space in the middle third ' +
      'where a short message would sit. ' +
      'No text, no lettering, no watermarks.',
  },
]

export function findSubject(id: string): ImageSubject | null {
  return SUBJECTS.find((subject) => subject.id === id) ?? null
}

/** Adjectives per visual style. One vocabulary, so subjects cannot disagree. */
const STYLE_WORDS: Record<string, string> = {
  gaming: 'bold, high-energy, neon-lit, competitive gaming aesthetic',
  futuristic: 'sleek, forward-looking, clean sci-fi surfaces and glowing edges',
  minimal: 'restrained, generous negative space, very few elements',
  luxury: 'refined, understated, premium materials, quiet confidence',
  technical: 'precise, schematic, grid-aligned, engineered feel',
  cinematic: 'dramatic lighting, deep contrast, filmic atmosphere',
  retro: 'nostalgic, analogue textures, period-authentic palette',
  professional: 'clean, credible, corporate-adjacent without being sterile',
  energetic: 'dynamic, kinetic, bright and fast-feeling',
}

const DETAIL_WORDS: Record<string, string> = {
  minimal: 'Keep it very simple — few shapes, little ornament.',
  balanced: 'Moderate detail: interesting up close, still readable at a glance.',
  detailed: 'Rich detail and texture, while keeping one clear focal point.',
}

export type PromptInput = {
  subject: ImageSubject
  brandName: string
  dna: BrandDna
  /** Anything the person typed. Appended last so it can steer the result. */
  extra?: string
}

/**
 * The full prompt sent to the provider.
 *
 * Stored verbatim on the asset afterwards. A generated image whose prompt was
 * not kept is unreproducible, and the whole point of recording provider, model
 * and prompt together is that you can get back to something you liked.
 */
export function buildPrompt({ subject, brandName, dna, extra }: PromptInput): string {
  const { colors, visualStyle, personality, rules } = dna

  const parts: string[] = [subject.instruction({ name: brandName })]

  parts.push(
    `Visual style: ${STYLE_WORDS[visualStyle.style] ?? visualStyle.style}.`,
    DETAIL_WORDS[visualStyle.detail] ?? '',
    `Overall it should feel ${visualStyle.canvas === 'dark' ? 'dark, on a deep background' : 'light, on a bright background'}.`,
  )

  parts.push(
    `Use this colour palette: primary ${colors.primary}, secondary ${colors.secondary}, ` +
      `accent ${colors.accent}, against ${colors.background}.`,
  )

  if (personality.length > 0) {
    parts.push(`The brand's character is ${personality.slice(0, 6).join(', ')}.`)
  }

  if (rules.prefer.length > 0) {
    parts.push(`Lean into: ${rules.prefer.slice(0, 8).join('; ')}.`)
  }

  if (rules.avoid.length > 0) {
    parts.push(`Avoid entirely: ${rules.avoid.slice(0, 8).join('; ')}.`)
  }

  if (extra?.trim()) {
    parts.push(extra.trim())
  }

  return parts.filter(Boolean).join(' ')
}

/**
 * A stream package: every subject, from one brand, in one go.
 *
 * Ordered cheapest-to-reason-about first — the logo is the piece everything
 * else is judged against, so it is generated first and shown first.
 */
export const PACKAGE_SUBJECT_IDS = [
  'logo-concept',
  'stream-background',
  'panel-art',
  'offline-card',
] as const
