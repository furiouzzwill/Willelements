import { z } from 'zod'

/**
 * Brand DNA — the creator's persistent visual identity.
 *
 * This is the single source of truth for how generated assets look: overlays,
 * alerts, graphics and motion all read from here. It is stored as JSON in
 * `brands.dna` and validated on the way in and out, so nothing downstream ever
 * has to guess whether a field is present.
 *
 * Every field has a default. A half-filled brand is still a usable brand —
 * onboarding should never block on completeness.
 */

/** A CSS hex colour. Stored uppercase so comparisons and dedupe are trivial. */
export const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, 'Use a 6-digit hex colour, e.g. #A855F7')
  .transform((value) => value.toUpperCase())

export const brandColors = z.object({
  primary: hexColor.default('#A855F7'),
  secondary: hexColor.default('#D946EF'),
  accent: hexColor.default('#22D3EE'),
  background: hexColor.default('#09090B'),
  text: hexColor.default('#FFFFFF'),
})

export const brandTypography = z.object({
  heading: z.string().min(1).default('Space Grotesk'),
  body: z.string().min(1).default('Inter'),
  display: z.string().min(1).optional(),
})

export const VISUAL_STYLES = [
  'gaming',
  'futuristic',
  'minimal',
  'luxury',
  'technical',
  'cinematic',
  'retro',
  'professional',
  'energetic',
] as const

export const brandVisualStyle = z.object({
  canvas: z.enum(['dark', 'light']).default('dark'),
  style: z.enum(VISUAL_STYLES).default('gaming'),
  detail: z.enum(['minimal', 'balanced', 'detailed']).default('balanced'),
})

export const MOTION_STYLES = [
  'smooth',
  'fast',
  'cinematic',
  'glitch',
  'technical',
  'fluid',
  'explosive',
  'minimal',
] as const

export const brandMotionStyle = z.object({
  energy: z.enum(['low', 'medium', 'high']).default('medium'),
  speed: z.enum(['slow', 'medium', 'fast']).default('medium'),
  style: z.array(z.enum(MOTION_STYLES)).default(['smooth']),
})

/**
 * Things this creator wants, and things they never want.
 *
 * Kept as free text rather than an enum: these become part of generation
 * prompts, and the useful ones are specific ("thin neon borders") in a way a
 * fixed list could not anticipate.
 */
export const brandRules = z.object({
  prefer: z.array(z.string().min(1).max(120)).max(20).default([]),
  avoid: z.array(z.string().min(1).max(120)).max(20).default([]),
})

export const brandDna = z.object({
  personality: z.array(z.string().min(1).max(40)).max(10).default([]),
  colors: brandColors.prefault({}),
  typography: brandTypography.prefault({}),
  visualStyle: brandVisualStyle.prefault({}),
  motionStyle: brandMotionStyle.prefault({}),
  rules: brandRules.prefault({}),
})

export type BrandDna = z.infer<typeof brandDna>
export type BrandColors = z.infer<typeof brandColors>

/** A fully-defaulted Brand DNA, for seeding and for filling gaps on read. */
export function defaultBrandDna(): BrandDna {
  return brandDna.parse({})
}

/** Input accepted when creating or updating a brand. */
export const brandInput = z.object({
  name: z.string().trim().min(1, 'Give your brand a name.').max(80),
  description: z.string().trim().max(500).nullish(),
  audience: z.string().trim().max(200).nullish(),
  creatorType: z
    .enum(['streamer', 'youtuber', 'podcaster', 'business', 'other'])
    .default('streamer'),
  dna: brandDna.prefault({}),
})

export type BrandInput = z.infer<typeof brandInput>
